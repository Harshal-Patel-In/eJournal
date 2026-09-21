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

    async def get_annotation_counts(self, journal_id: str) -> dict[str, int]:
        """Return counts of annotations by type for a journal."""
        comments = await self.find_many({"journalId": journal_id})
        counts: dict[str, int] = {}
        for c in comments:
            atype = c.get("type", "Comment")
            counts[atype] = counts.get(atype, 0) + 1
        return counts

    async def resolve_suggestions_for_deleted_blocks(
        self, journal_id: str, deleted_block_ids: list[str]
    ) -> int:
        """Resolve suggestions on deleted blocks and mark other open comments as blockDeleted."""
        if not deleted_block_ids:
            return 0
        now = datetime.now(timezone.utc)
        # Suggestions on deleted blocks are marked resolved with appliedAction: "deleted"
        query = {
            "journalId": journal_id,
            "blockId": {"$in": deleted_block_ids},
            "type": {"$regex": "^suggestion$", "$options": "i"},
            "status": {"$ne": "resolved"},
        }
        res = await self.update_many(
            query,
            {"$set": {"status": "resolved", "appliedAction": "deleted", "resolvedAt": now}},
        )
        # Other comments (warnings, questions) on deleted blocks get blockDeleted: True
        other_query = {
            "journalId": journal_id,
            "blockId": {"$in": deleted_block_ids},
            "type": {"$not": {"$regex": "^suggestion$", "$options": "i"}},
            "status": {"$ne": "resolved"},
        }
        await self.update_many(other_query, {"$set": {"blockDeleted": True}})
        return res
