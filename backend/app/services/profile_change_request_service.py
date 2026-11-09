"""Service handling student profile correction requests, smart bumping, and admin reviews.

RULE-BE01: All business logic MUST live in service classes.
RULE-BE05: Database operations live in repositories.
"""

from datetime import datetime, timezone, timedelta
from fastapi import status

from app.middleware.error_handler import AppException
from app.core.constants import ErrorCode
from app.repositories.profile_change_request_repository import ProfileChangeRequestRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.profile_change_request import (
    ProfileChangeRequestCreate,
    ProfileChangeRequestReject,
    AdminProfileUpdateRequest,
)


class ProfileChangeRequestService:
    """Service managing profile correction requests."""

    def __init__(self):
        self.request_repo = ProfileChangeRequestRepository()
        self.notification_repo = NotificationRepository()
        self.user_repo = UserRepository()
        self.audit_repo = AuditLogRepository()

    async def submit_change_request(
        self, user: dict, payload: ProfileChangeRequestCreate
    ) -> dict:
        """Submit a new record correction request with 1-request concurrency cap."""
        # 1. Check if user already has an active pending request
        existing = await self.request_repo.find_active_by_user_id(user["id"])
        if existing:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="You already have a pending profile correction request under administrative review.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Extract current value from user profile
        current_profile = user.get("profile", {})
        allowed_fields = {"name", "enrollmentNumber", "department", "college"}
        if payload.field not in allowed_fields:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Direct correction requests are only supported for: {', '.join(allowed_fields)}.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        current_value = str(current_profile.get(payload.field) or "Not configured")
        clean_requested = payload.requestedValue.strip()

        if payload.field == "enrollmentNumber":
            clean_requested = clean_requested.upper()

        if current_value == clean_requested:
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Requested value is identical to your current database value.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Create request record in MongoDB
        student_name = current_profile.get("name") or user.get("name") or "Enrolled Student"
        current_enr = current_profile.get("enrollmentNumber") or "PENDING"
        dept = current_profile.get("department") or "General"
        college = current_profile.get("college") or "CHARUSAT"
        student_email = user.get("email") or ""
        semester = str(current_profile.get("semester") or "")
        division = str(current_profile.get("division") or "")
        batch = str(current_profile.get("batch") or "")

        req_doc = await self.request_repo.create_request(
            user_id=user["id"],
            user_role=user.get("role", "student"),
            student_name=student_name,
            current_enrollment=current_enr,
            department=dept,
            college=college,
            field=payload.field,
            current_value=current_value,
            requested_value=clean_requested,
            reason=payload.reason.strip(),
            student_email=student_email,
            semester=semester,
            division=division,
            batch=batch,
        )

        # 4. Notify all administrators with 'admin_request' category
        admin_users = await self.user_repo.find_many(
            {"$or": [{"role": "admin"}, {"isAdmin": True}, {"is_admin": True}]}
        )
        admin_ids = [u["id"] for u in admin_users if "id" in u]

        if admin_ids:
            field_display = payload.field
            if field_display == "enrollmentNumber":
                field_display = "Enrollment Number"
            elif field_display == "name":
                field_display = "Legal Name"

            title = "Profile Correction Request"
            message = (
                f"{student_name} ({current_enr}) requested a {field_display} correction: "
                f"'{current_value}' -> '{clean_requested}'."
            )
            meta = {
                "subCategory": "profile_correction",
                "requestId": req_doc["id"],
                "studentId": user["id"],
                "studentName": student_name,
                "currentEnrollment": current_enr,
                "field": payload.field,
                "currentValue": current_value,
                "requestedValue": clean_requested,
                "reason": payload.reason.strip(),
                "bumpCount": 0,
            }

            await self.notification_repo.create_many_notifications(
                user_ids=admin_ids,
                title=title,
                message=message,
                type_str="admin_request",
                link="/admin/students",
                metadata=meta,
                entity_type="profile_change_request",
                entity_id=req_doc["id"],
                category="admin_request",
            )

        return req_doc

    async def get_active_request(self, user: dict) -> dict | None:
        """Fetch the student's current active pending request if any."""
        return await self.request_repo.find_active_by_user_id(user["id"])

    async def bump_request(self, user: dict, request_id: str) -> dict:
        """Bump request to the top of the admin's notification stack with 24h cooldown."""
        req = await self.request_repo.find_by_id(request_id)
        if not req or req.get("userId") != user["id"]:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Profile correction request not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if req.get("status") != "pending":
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Only pending requests can be reminded.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Check 24-hour cooldown
        now = datetime.now(timezone.utc)
        last_action_time = req.get("lastBumpedAt") or req.get("createdAt")
        if last_action_time:
            if last_action_time.tzinfo is None:
                last_action_time = last_action_time.replace(tzinfo=timezone.utc)
            cooldown_delta = now - last_action_time
            if cooldown_delta < timedelta(hours=24):
                hours_remaining = 24 - int(cooldown_delta.total_seconds() // 3600)
                raise AppException(
                    code=ErrorCode.VALIDATION_ERROR,
                    message=f"Reminder cooldown active. You can send another reminder in approximately {hours_remaining} hours.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        # Update request bump count and timestamps
        updated_req = await self.request_repo.bump_request(request_id)

        # Bump corresponding admin notifications: update createdAt to now so they sort to the very top!
        bump_count = updated_req.get("bumpCount", 1)
        await self.notification_repo.collection.update_many(
            {"entityType": "profile_change_request", "entityId": request_id},
            {
                "$set": {
                    "createdAt": now,
                    "updatedAt": now,
                    "isRead": False,
                    "metadata.bumpCount": bump_count,
                    "metadata.isBumped": True,
                }
            },
        )

        return updated_req

    async def discard_request(self, user: dict, request_id: str) -> dict:
        """Student self-cancels / discards an active request."""
        req = await self.request_repo.find_by_id(request_id)
        if not req or req.get("userId") != user["id"]:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Profile correction request not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if req.get("status") != "pending":
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Only pending requests can be discarded.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        await self.request_repo.discard_request(request_id)

        # Remove corresponding admin notifications to keep the inbox clean
        await self.notification_repo.collection.delete_many(
            {"$or": [
                {"entityType": "profile_change_request", "entityId": request_id},
                {"metadata.requestId": request_id}
            ]}
        )

        return {"message": "Profile correction request withdrawn successfully."}

    async def list_pending_requests(self, page: int = 1, limit: int = 50) -> dict:
        """List all pending profile correction requests for the admin console."""
        items = await self.request_repo.find_pending(page=page, limit=limit)
        total = await self.request_repo.count_pending()
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
        }

    async def approve_request(
        self,
        admin_user: dict,
        request_id: str,
        override_payload: AdminProfileUpdateRequest | None = None,
    ) -> dict:
        """Approve correction request and apply updates to the student's profile."""
        req = await self.request_repo.find_by_id(request_id)
        if not req:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Correction request not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if req.get("status") != "pending":
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Request is already in '{req.get('status')}' status.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        target_user_id = req["userId"]
        target_user = await self.user_repo.find_by_id(target_user_id)
        if not target_user:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Target student account not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Determine changes to apply - ensure requested value is preserved unless explicitly overridden
        profile_patch = {req["field"]: req["requestedValue"]}
        if override_payload:
            payload_dict = override_payload.model_dump(exclude_unset=True)
            for k in ["name", "enrollmentNumber", "facultyId", "department", "semester", "division", "batch", "college", "designation"]:
                if k in payload_dict and payload_dict[k] is not None and str(payload_dict[k]).strip():
                    profile_patch[k] = payload_dict[k]

        # If changing enrollment number, ensure uniqueness across students
        new_enr = profile_patch.get("enrollmentNumber")
        if new_enr:
            clean_enr = str(new_enr).strip().upper()
            existing_student = await self.user_repo.find_one(
                {"profile.enrollmentNumber": clean_enr, "_id": {"$ne": self.user_repo._to_object_id(target_user_id)}}
            )
            if existing_student:
                raise AppException(
                    code=ErrorCode.VALIDATION_ERROR,
                    message=f"Enrollment number '{clean_enr}' is already assigned to another student.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            profile_patch["enrollmentNumber"] = clean_enr

        # Commit update to user profile
        current_profile = target_user.get("profile", {})
        merged = {**current_profile, **profile_patch}
        await self.user_repo.update_profile(target_user_id, merged, is_complete=True)

        # Mark request approved
        admin_notes = override_payload.adminNotes if override_payload else None
        await self.request_repo.approve_request(
            request_id=request_id,
            admin_id=admin_user["id"],
            admin_notes=admin_notes,
        )

        # Remove or mark read the admin notification
        await self.notification_repo.collection.delete_many(
            {"$or": [
                {"entityType": "profile_change_request", "entityId": request_id},
                {"metadata.requestId": request_id}
            ]}
        )

        # Dispatch real-time approval notification to the student
        await self.notification_repo.create_notification(
            user_id=target_user_id,
            title="Academic Profile Updated",
            message="Your profile correction request has been approved by the administration. Your credentials are now synchronized across all laboratory journals.",
            type_str="approval",
            link="/profile",
            category="approval",
        )

        # Log audit event
        await self.audit_repo.log_event(
            user_id=admin_user["id"],
            action="ADMIN_PROFILE_OVERRIDE",
            entity="users",
            entity_id=target_user_id,
            metadata={
                "requestId": request_id,
                "appliedChanges": profile_patch,
                "adminNotes": admin_notes,
            },
        )

        updated_student = await self.user_repo.find_by_id(target_user_id)
        return {
            "message": "Student profile updated successfully.",
            "student": updated_student,
        }

    async def reject_request(
        self, admin_user: dict, request_id: str, payload: ProfileChangeRequestReject
    ) -> dict:
        """Reject correction request with a required explanation note."""
        req = await self.request_repo.find_by_id(request_id)
        if not req:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Correction request not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if req.get("status") != "pending":
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Request is already in '{req.get('status')}' status.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        reason = payload.rejectionReason.strip()
        await self.request_repo.reject_request(
            request_id=request_id,
            admin_id=admin_user["id"],
            rejection_reason=reason,
        )

        # Remove the admin notification so it leaves the pending attention queue
        await self.notification_repo.collection.delete_many(
            {"$or": [
                {"entityType": "profile_change_request", "entityId": request_id},
                {"metadata.requestId": request_id}
            ]}
        )

        # Notify the student with category 'warning' (subject to 7-day TTL once read)
        field_display = req.get("field", "profile field")
        if field_display == "enrollmentNumber":
            field_display = "Enrollment Number"

        await self.notification_repo.create_notification(
            user_id=req["userId"],
            title="Profile Correction Request Rejected",
            message=f"Your request to change your {field_display} was rejected: {reason}",
            type_str="warning",
            link="/profile",
            category="warning",
            metadata={"requestId": request_id, "rejectionReason": reason},
        )

        # Audit log event
        await self.audit_repo.log_event(
            user_id=admin_user["id"],
            action="ADMIN_PROFILE_REQUEST_REJECTED",
            entity="profile_change_requests",
            entity_id=request_id,
            metadata={"reason": reason, "targetUserId": req["userId"]},
        )

        return {"message": "Profile correction request rejected."}

    async def direct_admin_update(
        self, admin_user: dict, target_user_id: str, payload: AdminProfileUpdateRequest
    ) -> dict:
        """Direct administrative override of a student or faculty profile."""
        target_user = await self.user_repo.find_by_id(target_user_id)
        if not target_user:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="User account not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        patch = {}
        payload_dict = payload.model_dump(exclude_unset=True)
        for k in ["name", "enrollmentNumber", "facultyId", "department", "semester", "division", "batch", "college", "designation"]:
            if k in payload_dict and payload_dict[k] is not None:
                patch[k] = payload_dict[k]

        if "enrollmentNumber" in patch and patch["enrollmentNumber"]:
            clean_enr = str(patch["enrollmentNumber"]).strip().upper()
            existing = await self.user_repo.find_one(
                {"profile.enrollmentNumber": clean_enr, "_id": {"$ne": self.user_repo._to_object_id(target_user_id)}}
            )
            if existing:
                raise AppException(
                    code=ErrorCode.VALIDATION_ERROR,
                    message=f"Enrollment number '{clean_enr}' is already assigned to another student.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            patch["enrollmentNumber"] = clean_enr

        current_profile = target_user.get("profile", {})
        merged = {**current_profile, **patch}
        await self.user_repo.update_profile(target_user_id, merged, is_complete=True)

        # If student/user has an active pending change request, auto-resolve it!
        active_req = await self.request_repo.find_active_by_user_id(target_user_id)
        if active_req:
            await self.request_repo.approve_request(
                request_id=active_req["id"],
                admin_id=admin_user["id"],
                admin_notes=payload.adminNotes or "Approved via direct administrative profile update.",
            )
            await self.notification_repo.collection.delete_many(
                {"$or": [
                    {"entityType": "profile_change_request", "entityId": active_req["id"]},
                    {"metadata.requestId": active_req["id"]}
                ]}
            )
            await self.notification_repo.create_notification(
                user_id=target_user_id,
                title="Academic Profile Updated",
                message="Your profile has been updated and synchronized with institutional records by the administration.",
                type_str="approval",
                link="/profile",
                category="approval",
            )

        # Audit log event
        await self.audit_repo.log_event(
            user_id=admin_user["id"],
            action="ADMIN_PROFILE_OVERRIDE",
            entity="users",
            entity_id=target_user_id,
            metadata={"appliedChanges": patch, "adminNotes": payload.adminNotes},
        )

        return await self.user_repo.find_by_id(target_user_id)
