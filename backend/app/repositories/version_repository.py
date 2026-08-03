"""Repository class managing immutable Journal Version Snapshots inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class VersionRepository(BaseRepository):
    """Journal versions database access repository."""

    collection_name = "journal_versions"

    async def create_snapshot(
        self,
        journal_id: str,
        author_id: str,
        status: str,
        blocks: list,
        title: str,
        revision_number: int,
        remarks: str | None = None,
    ) -> dict:
        """Create an immutable snapshot of a journal state (e.g. upon submission or approval)."""
        snapshot_doc = {
            "journalId": journal_id,
            "authorId": author_id,
            "revisionNumber": revision_number,
            "status": status,
            "title": title,
            "blocks": blocks,
            "remarks": remarks,
            "createdAt": datetime.now(timezone.utc),
        }
        version_id = await self.insert_one(snapshot_doc)
        return await self.find_by_id(version_id)

    async def find_journal_versions(self, journal_id: str) -> list[dict]:
        """Find all historical revision snapshots for a journal, ordered chronologically."""
        return await self.find_many({"journalId": journal_id})

    async def find_latest_submission_snapshot(self, journal_id: str) -> dict | None:
        """Find the latest submitted/resubmitted immutable snapshot for a journal."""
        doc = self.collection.find_one(
            {"journalId": journal_id, "status": "submitted"},
            sort=[("createdAt", -1)],
        )
        return self._to_str_id(doc)
