"""Repository class managing Comment persistence inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class CommentRepository(BaseRepository):
    """Comment database access repository."""

    collection_name = "comments"

    async def create_comment(self, comment_data: dict) -> dict:
        """Create a new block comment or threaded reply."""
        comment_id = await self.insert_one(comment_data)
        doc = await self.find_by_id(comment_id)
        return doc

    async def find_journal_comments(self, journal_id: str) -> list[dict]:
        """Find all comments belonging to a specific journal."""
        return await self.find_many({"journalId": journal_id})

    async def resolve_comment(self, comment_id: str) -> bool:
        """Mark a comment thread as resolved."""
        return await self.update_by_id(
            comment_id,
            {"$set": {"status": "resolved", "resolvedAt": datetime.now(timezone.utc)}},
        )
