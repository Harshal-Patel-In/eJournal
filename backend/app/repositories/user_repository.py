"""Repository class managing user persistence inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone

from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    """User database access repository."""

    collection_name = "users"

    async def find_by_email(self, email: str) -> dict | None:
        """Look up user by unique email."""
        doc = await self.collection.find_one({"email": email.lower().strip()})
        return self._to_str_id(doc)

    async def update_otp(
        self, user_id: str, otp: str, expires_at: datetime
    ) -> bool:
        """Store verification OTP with expiration timeline."""
        return await self.update_by_id(
            user_id,
            {
                "$set": {
                    "otp": otp,
                    "otp_expires_at": expires_at,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def record_otp_failure(self, user_id: str) -> bool:
        """Increment failed OTP attempts count for brute-force protection (SEC-05)."""
        return await self.update_by_id(
            user_id,
            {"$inc": {"otp_failed_attempts": 1}},
        )

    async def reset_otp_credentials(self, user_id: str, clear_all: bool = False) -> bool:
        """Reset failed OTP counter and optionally clear OTP tokens."""
        update_doc: dict = {"$set": {"otp_failed_attempts": 0, "updatedAt": datetime.now(timezone.utc)}}
        if clear_all:
            update_doc["$set"]["otp"] = None
            update_doc["$set"]["otp_expires_at"] = None
        return await self.update_by_id(user_id, update_doc)

    async def verify_user(self, user_id: str) -> bool:
        """Mark user account as verified and clear OTP credentials."""
        return await self.update_by_id(
            user_id,
            {
                "$set": {
                    "is_verified": True,
                    "otp_failed_attempts": 0,
                    "updatedAt": datetime.now(timezone.utc),
                },
                "$unset": {
                    "otp": "",
                    "otp_expires_at": "",
                },
            },
        )

    async def update_profile(
        self, user_id: str, profile_data: dict, is_complete: bool
    ) -> bool:
        """Update embedded academic profile fields and profile completion lock state."""
        update_fields = {}
        for key, val in profile_data.items():
            if val is not None:
                update_fields[f"profile.{key}"] = val

        update_fields["is_profile_complete"] = is_complete
        if is_complete:
            update_fields["status"] = "active"
        update_fields["updatedAt"] = datetime.now(timezone.utc)

        return await self.update_by_id(user_id, {"$set": update_fields})

    async def find_existing_by_emails_or_enrollments(
        self, emails: list[str], enrollments: list[str]
    ) -> tuple[set[str], set[str]]:
        """Pre-flight check for duplicate emails or enrollment numbers across the user directory."""
        query_conditions = []
        if emails:
            query_conditions.append({"email": {"$in": [e.lower().strip() for e in emails]}})
        if enrollments:
            query_conditions.append({"profile.enrollmentNumber": {"$in": [en.upper().strip() for en in enrollments]}})

        if not query_conditions:
            return set(), set()

        cursor = self.collection.find(
            {"$or": query_conditions},
            {"email": 1, "profile.enrollmentNumber": 1},
        )
        existing_docs = await cursor.to_list(length=None)

        existing_emails = {doc.get("email", "").lower().strip() for doc in existing_docs if doc.get("email")}
        existing_enrollments = {
            doc.get("profile", {}).get("enrollmentNumber", "").upper().strip()
            for doc in existing_docs
            if doc.get("profile", {}).get("enrollmentNumber")
        }
        return existing_emails, existing_enrollments

    async def bulk_insert_users(self, user_docs: list[dict]) -> int:
        """Atomic batch insertion of user documents."""
        if not user_docs:
            return 0
        result = await self.collection.insert_many(user_docs, ordered=False)
        return len(result.inserted_ids)
