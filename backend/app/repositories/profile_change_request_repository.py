"""Repository class managing student profile correction requests in MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone
from bson import ObjectId

from app.repositories.base import BaseRepository


class ProfileChangeRequestRepository(BaseRepository):
    """Repository handling profile correction requests."""

    collection_name = "profile_change_requests"

    async def create_request(
        self,
        user_id: str,
        user_role: str,
        student_name: str,
        current_enrollment: str,
        department: str,
        college: str,
        field: str,
        current_value: str,
        requested_value: str,
        reason: str,
        student_email: str = "",
        semester: str = "",
        division: str = "",
        batch: str = "",
    ) -> dict:
        """Create a new profile change request in pending status."""
        now = datetime.now(timezone.utc)
        doc = {
            "userId": user_id,
            "userRole": user_role,
            "studentName": student_name,
            "studentEmail": student_email,
            "currentEnrollmentNumber": current_enrollment,
            "department": department,
            "college": college,
            "semester": semester,
            "division": division,
            "batch": batch,
            "field": field,
            "currentValue": current_value,
            "requestedValue": requested_value,
            "reason": reason,
            "status": "pending",
            "rejectionReason": None,
            "adminNotes": None,
            "bumpCount": 0,
            "lastBumpedAt": None,
            "createdAt": now,
            "updatedAt": now,
            "reviewedBy": None,
            "reviewedAt": None,
        }
        await self.insert_one(doc)
        return self._to_str_id(doc)

    async def find_active_by_user_id(self, user_id: str) -> dict | None:
        """Find an active (pending) request for a specific student."""
        return await self.find_one({"userId": user_id, "status": "pending"})

    async def find_pending(self, page: int = 1, limit: int = 50) -> list[dict]:
        """Find pending requests sorted by most recently updated/bumped first."""
        skip = (page - 1) * limit
        return await self.find_many(
            {"status": "pending"},
            sort=[("updatedAt", -1), ("createdAt", -1)],
            skip=skip,
            limit=limit,
        )

    async def count_pending(self) -> int:
        """Count total pending requests for admin badges."""
        return await self.count({"status": "pending"})

    async def bump_request(self, request_id: str) -> dict | None:
        """Increment bump count and update timestamp."""
        now = datetime.now(timezone.utc)
        oid = self._to_object_id(request_id)
        await self.collection.update_one(
            {"_id": oid},
            {
                "$inc": {"bumpCount": 1},
                "$set": {"lastBumpedAt": now, "updatedAt": now},
            },
        )
        return await self.find_by_id(request_id)

    async def discard_request(self, request_id: str) -> bool:
        """Discard / withdraw an active request."""
        now = datetime.now(timezone.utc)
        oid = self._to_object_id(request_id)
        return await self.collection.update_one(
            {"_id": oid},
            {"$set": {"status": "discarded", "updatedAt": now}},
        )

    async def approve_request(
        self, request_id: str, admin_id: str, admin_notes: str | None = None
    ) -> bool:
        """Mark request as approved by administration."""
        now = datetime.now(timezone.utc)
        oid = self._to_object_id(request_id)
        res = await self.collection.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "approved",
                    "reviewedBy": admin_id,
                    "reviewedAt": now,
                    "adminNotes": admin_notes,
                    "updatedAt": now,
                }
            },
        )
        return res.modified_count > 0

    async def reject_request(
        self, request_id: str, admin_id: str, rejection_reason: str
    ) -> bool:
        """Mark request as rejected with mandatory reason note."""
        now = datetime.now(timezone.utc)
        oid = self._to_object_id(request_id)
        res = await self.collection.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "rejected",
                    "reviewedBy": admin_id,
                    "reviewedAt": now,
                    "rejectionReason": rejection_reason,
                    "updatedAt": now,
                }
            },
        )
        return res.modified_count > 0

