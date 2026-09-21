"""Authentication and Profile management business logic service.

RULE-BE04: All business logic MUST live inside service classes.
RULE-SEC10: Audit logs created for sensitive events (login, register).
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserMeResponse, UserRegisterRequest
from app.schemas.profile import ProfileUpdateRequest
from app.utils.email import send_otp_email
from app.utils.security import hash_password, verify_password, create_jwt_token


class AuthService:
    """Authentication and profile manager service."""

    def __init__(self):
        self.user_repo = UserRepository()
        self.audit_repo = AuditLogRepository()

    @staticmethod
    def _generate_otp() -> str:
        """Generate a cryptographically secure 6-digit OTP code (SEC-11)."""
        return str(secrets.randbelow(900000) + 100000)


    async def register(self, request: UserRegisterRequest, ip_address: str | None = None) -> dict:
        """Register a new unverified user and send an OTP code."""
        # Check if email is already taken
        existing_user = await self.user_repo.find_by_email(request.email)
        if existing_user:
            if existing_user.get("is_verified", False):
                raise AppException(
                    code=ErrorCode.EMAIL_ALREADY_EXISTS,
                    message="Institutional email is already registered",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            
            # Unverified account retry: update password, regenerate OTP, and resend
            password_hash = hash_password(request.password)
            otp = self._generate_otp()
            otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
            
            await self.user_repo.update_by_id(
                existing_user["id"],
                {
                    "$set": {
                        "password_hash": password_hash,
                        "otp": otp,
                        "otp_expires_at": otp_expiry,
                        "updatedAt": datetime.now(timezone.utc),
                    }
                }
            )
            
            await send_otp_email(request.email, otp)
            return {"userId": existing_user["id"], "email": request.email}

        password_hash = hash_password(request.password)
        otp = self._generate_otp()
        otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)

        user_doc = {
            "email": request.email.lower().strip(),
            "password_hash": password_hash,
            "role": request.role,
            "is_verified": False,
            "is_profile_complete": False,
            "otp": otp,
            "otp_expires_at": otp_expiry,
            "profile": {
                "name": None,
                "department": None,
                "semester": None,
                "division": None,
                "enrollmentNumber": None,
                "facultyId": None,
                "designation": None,
                "college": None,
                "university": None,
                "profilePhoto": None,
            },
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }

        user_id = await self.user_repo.insert_one(user_doc)

        # Dispatch OTP
        await send_otp_email(request.email, otp)

        # Log audit trail (RULE-LOG03 / RULE-SEC10)
        await self.audit_repo.log_event(
            user_id=user_id,
            action="USER_REGISTERED",
            entity="users",
            entity_id=user_id,
            ip_address=ip_address,
        )

        return {"userId": user_id, "email": request.email}

    async def verify_otp(self, email: str, otp_code: str, ip_address: str | None = None) -> str:
        """Verify the OTP code, activate account, and return access token."""
        user = await self.user_repo.find_by_email(email)
        if not user:
            raise AppException(
                code=ErrorCode.USER_NOT_FOUND,
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if user.get("is_verified", False):
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Account already verified",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        stored_otp = user.get("otp")
        expiry = user.get("otp_expires_at")
        failed_attempts = user.get("otp_failed_attempts", 0)

        # Brute force protection: lock after 5 failed attempts (SEC-05)
        if failed_attempts >= 5:
            # Clear invalid OTP so user must explicitly request a new one
            await self.user_repo.reset_otp_credentials(user["id"], clear_all=True)
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Too many failed attempts. Verification code has been invalidated. Please request a new one.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not stored_otp or stored_otp != otp_code:
            await self.user_repo.record_otp_failure(user["id"])
            raise AppException(
                code=ErrorCode.INVALID_OTP,
                message="Verification code is invalid",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Handle explicit timezone comparison safely
        if expiry:
            # Pymongo might return naive datetime. Treat as UTC.
            expiry_utc = expiry.replace(tzinfo=timezone.utc) if expiry.tzinfo is None else expiry
            if datetime.now(timezone.utc) > expiry_utc:
                raise AppException(
                    code=ErrorCode.INVALID_OTP,
                    message="Verification code expired",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        # Verify and activate (RULE-AUTH04, SEC-05: verify_user clears OTP and resets failed attempts)
        await self.user_repo.verify_user(user["id"])

        # Create JWT access token
        access_token = create_jwt_token(
            data={
                "sub": user["email"],
                "role": user["role"],
                "is_profile_complete": user.get("is_profile_complete", False),
            }
        )

        # Log audit trail
        await self.audit_repo.log_event(
            user_id=user["id"],
            action="EMAIL_VERIFIED",
            entity="users",
            entity_id=user["id"],
            ip_address=ip_address,
        )

        return access_token

    async def resend_otp(self, email: str) -> None:
        """Regenerate verification code and resend email with rate limiting cooldown."""
        user = await self.user_repo.find_by_email(email)
        if not user:
            raise AppException(
                code=ErrorCode.USER_NOT_FOUND,
                message="User not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if user.get("is_verified", False):
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Account already verified",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 30-second cooldown check to prevent mail quota exhaustion (SEC-05)
        now = datetime.now(timezone.utc)
        last_sent = user.get("otp_sent_at")
        if last_sent:
            last_sent_utc = last_sent.replace(tzinfo=timezone.utc) if last_sent.tzinfo is None else last_sent
            if (now - last_sent_utc).total_seconds() < 30:
                raise AppException(
                    code=ErrorCode.VALIDATION_ERROR,
                    message="Please wait 30 seconds before requesting another verification code",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        otp = self._generate_otp()
        otp_expiry = now + timedelta(minutes=10)

        await self.user_repo.update_by_id(
            user["id"],
            {
                "$set": {
                    "otp": otp,
                    "otp_expires_at": otp_expiry,
                    "otp_sent_at": now,
                    "otp_failed_attempts": 0,
                    "updatedAt": now,
                }
            }
        )
        await send_otp_email(user["email"], otp)


    async def login(self, email: str, password: str, ip_address: str | None = None) -> tuple[str, dict]:
        """Validate credentials, check verification, and return token + user details."""
        user = await self.user_repo.find_by_email(email)
        if not user or not verify_password(password, user["password_hash"]):
            raise AppException(
                code=ErrorCode.INVALID_CREDENTIALS,
                message="Invalid email or password",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        # Check verification state
        if not user.get("is_verified", False):
            raise AppException(
                code=ErrorCode.UNAUTHORIZED,
                message="Email address not verified",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Create access token
        access_token = create_jwt_token(
            data={
                "sub": user["email"],
                "role": user["role"],
                "is_profile_complete": user.get("is_profile_complete", False),
            }
        )

        # Log audit trail
        await self.audit_repo.log_event(
            user_id=user["id"],
            action="USER_LOGGED_IN",
            entity="users",
            entity_id=user["id"],
            ip_address=ip_address,
        )

        return access_token, user

    async def update_profile(self, user: dict, update: ProfileUpdateRequest) -> dict:
        """Update user profile academic details and enforce profile locking rules."""
        profile_dict = update.model_dump(exclude_unset=True)
        if not profile_dict:
            return user

        # Construct merged profile dictionary to validate completeness
        current_profile = user.get("profile", {})
        merged_profile = {**current_profile, **profile_dict}

        # Check profile completeness based on user role (RULE-AUTH06)
        is_complete = False
        if user["role"] == "student":
            required_student_fields = [
                "name",
                "department",
                "semester",
                "division",
                "enrollmentNumber",
                "college",
                "university",
            ]
            is_complete = all(
                merged_profile.get(f) is not None
                and str(merged_profile.get(f)).strip() != ""
                for f in required_student_fields
            )
        elif user["role"] == "teacher":
            required_teacher_fields = [
                "name",
                "department",
                "facultyId",
                "designation",
                "college",
                "university",
            ]
            is_complete = all(
                merged_profile.get(f) is not None
                and str(merged_profile.get(f)).strip() != ""
                for f in required_teacher_fields
            )

        # Commit updates
        await self.user_repo.update_profile(user["id"], profile_dict, is_complete)

        # Fetch updated user object
        updated_user = await self.user_repo.find_by_id(user["id"])

        # Audit log event
        await self.audit_repo.log_event(
            user_id=user["id"],
            action="PROFILE_UPDATED",
            entity="users",
            entity_id=user["id"],
        )

        return updated_user
