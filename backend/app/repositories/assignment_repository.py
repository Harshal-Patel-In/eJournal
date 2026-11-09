"""Repository class managing assignment/practical templates inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from app.repositories.base import BaseRepository


class AssignmentRepository(BaseRepository):
    """Assignment database access repository."""

    collection_name = "assignments"

    async def find_by_classroom_id(
        self, classroom_id: str, include_scheduled: bool = True
    ) -> list[dict]:
        """List assignments published for a specific classroom.
        
        If include_scheduled is False (e.g. for students), excludes future scheduled assignments.
        """
        query: dict = {"classroomId": classroom_id}
        if not include_scheduled:
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            query["$or"] = [
                {"publishDate": None},
                {"publishDate": {"$lte": now}},
            ]
        cursor = self.collection.find(query).sort("experimentNumber", 1)
        docs = await cursor.to_list(length=200)
        return [self._to_str_id(doc) for doc in docs]

    async def is_assignment_exists(
        self, classroom_id: str, experiment_number: int
    ) -> bool:
        """Check if an assignment with the same experiment number exists in the classroom."""
        count = await self.collection.count_documents(
            {"classroomId": classroom_id, "experimentNumber": experiment_number}
        )
        return count > 0
