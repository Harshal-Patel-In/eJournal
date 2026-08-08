"""Repository class managing immutable Journal Version Snapshots inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

import hashlib
import json
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
        revision_number: int | None = None,
        remarks: str | None = None,
    ) -> dict:
        """Create an immutable snapshot of a journal state (e.g. upon submission or approval)."""
        latest = await self.find_one(
            {"journalId": journal_id},
            sort=[("revisionNumber", -1)],
        )

        def _get_hash(b_list: list) -> str:
            return hashlib.sha256(json.dumps(b_list, sort_keys=True, default=str).encode("utf-8")).hexdigest()

        # Deduplication check: If latest existing snapshot has identical blocks and status, reuse latest
        if latest and _get_hash(latest.get("blocks", [])) == _get_hash(blocks) and latest.get("status") == status:
            return latest

        if revision_number is None:
            revision_number = (latest.get("revisionNumber", 0) + 1) if latest else 1
        else:
            existing = await self.find_one(
                {"journalId": journal_id, "revisionNumber": revision_number}
            )
            if existing:
                revision_number = (latest.get("revisionNumber", 0) + 1) if latest else (revision_number + 1)

        snapshot_doc = {
            "journalId": journal_id,
            "authorId": author_id,
            "revisionNumber": revision_number,
            "title": title,
            "status": status,
            "blocks": blocks,
            "remarks": remarks,
            "createdAt": datetime.now(timezone.utc),
        }
        version_id = await self.insert_one(snapshot_doc)
        return await self.find_by_id(version_id)

    async def get_latest_revision_number(self, journal_id: str) -> int:
        """Find the highest existing revision number for a journal."""
        docs = await self.find_many({"journalId": journal_id})
        if not docs:
            return 0
        return max([d.get("revisionNumber", 0) for d in docs if isinstance(d.get("revisionNumber"), int)], default=0)

    async def find_journal_versions(self, journal_id: str) -> list[dict]:
        """Find all historical revision snapshots for a journal, ordered chronologically."""
        return await self.find_many({"journalId": journal_id})

    async def find_latest_submission_snapshot(self, journal_id: str) -> dict | None:
        """Find the latest submitted/resubmitted immutable snapshot for a journal."""
        return await self.find_one(
            {"journalId": journal_id, "status": "submitted"},
            sort=[("createdAt", -1)],
        )
