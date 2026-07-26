"""Repository class managing assignment/practical templates inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from app.repositories.base import BaseRepository


class AssignmentRepository(BaseRepository):
    """Assignment database access repository."""

    collection_name = "assignments"

    async def find_by_classroom_id(self, classroom_id: str) -> list[dict]:
        """List assignments published for a specific classroom."""
        cursor = self.collection.find({"classroomId": classroom_id})
        return [self._to_str_id(doc) for doc in cursor]

    async def is_assignment_exists(
        self, classroom_id: str, experiment_number: int
    ) -> bool:
        """Check if an assignment with the same experiment number exists in the classroom."""
        count = self.collection.count_documents(
            {"classroomId": classroom_id, "experimentNumber": experiment_number}
        )
        return count > 0
