"""Repository class managing student classroom enrollments in MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class ClassroomMembershipRepository(BaseRepository):
    """Classroom membership database access repository."""

    collection_name = "classroom_memberships"

    async def add_member(self, classroom_id: str, student_id: str) -> str:
        """Enroll a student in a classroom (idempotent unique constraint checked via compound index)."""
        doc = {
            "classroomId": classroom_id,
            "studentId": student_id,
            "joinedAt": datetime.now(timezone.utc),
            "status": "active",
        }
        return await self.insert_one(doc)

    async def is_member(self, classroom_id: str, student_id: str) -> bool:
        """Check if student is enrolled in the classroom."""
        count = self.collection.count_documents(
            {"classroomId": classroom_id, "studentId": student_id}
        )
        return count > 0

    async def find_by_student_id(self, student_id: str) -> list[dict]:
        """List memberships for a student."""
        cursor = self.collection.find({"studentId": student_id})
        return [self._to_str_id(doc) for doc in cursor]

    async def find_members_by_classroom_id(self, classroom_id: str) -> list[dict]:
        """List all memberships in a classroom."""
        cursor = self.collection.find({"classroomId": classroom_id})
        return [self._to_str_id(doc) for doc in cursor]

    async def remove_member(self, classroom_id: str, student_id: str) -> bool:
        """Remove student from classroom."""
        return await self.delete_one(
            {"classroomId": classroom_id, "studentId": student_id}
        )
