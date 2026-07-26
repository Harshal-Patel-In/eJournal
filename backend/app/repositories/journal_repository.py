"""Repository class managing Journal persistence inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class JournalRepository(BaseRepository):
    """Journal database access repository."""

    collection_name = "journals"

    async def find_student_journal_for_assignment(
        self, student_id: str, assignment_id: str
    ) -> dict | None:
        """Find a journal submitted by a specific student for an assignment."""
        doc = self.collection.find_one(
            {"studentId": student_id, "assignmentId": assignment_id}
        )
        return self._to_str_id(doc)

    async def update_journal_blocks(
        self, journal_id: str, title: str, blocks: list
    ) -> bool:
        """Atomically update the journal's blocks array and title (RULE-DB12)."""
        return await self.update_by_id(
            journal_id,
            {
                "$set": {
                    "title": title,
                    "blocks": blocks,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
