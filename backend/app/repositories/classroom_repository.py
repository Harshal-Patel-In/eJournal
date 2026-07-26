"""Repository class managing classroom persistence in MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from app.repositories.base import BaseRepository


class ClassroomRepository(BaseRepository):
    """Classroom database access repository."""

    collection_name = "classrooms"

    async def find_by_join_code(self, join_code: str) -> dict | None:
        """Find classroom by unique join code."""
        doc = self.collection.find_one({"joinCode": join_code.upper().strip()})
        return self._to_str_id(doc)

    async def find_by_teacher_id(self, teacher_id: str) -> list[dict]:
        """List classrooms created by a teacher."""
        cursor = self.collection.find({"teacherId": teacher_id})
        return [self._to_str_id(doc) for doc in cursor]

    async def is_join_code_exists(self, join_code: str) -> bool:
        """Check if a join code is already assigned to a classroom."""
        count = self.collection.count_documents({"joinCode": join_code.upper().strip()})
        return count > 0
