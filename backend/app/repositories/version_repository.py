"""Repository class managing immutable Journal Version records inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
RULE-VH01: Historical revisions must remain immutable.
RULE-VH02: Revisions MUST be stored in journal_versions collection.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class VersionRepository(BaseRepository):
    """Journal versions database access repository."""

    collection_name = "journal_versions"

    async def create_version_record(
        self,
        journal_id: str,
        author_id: str,
        status: str,
        title: str,
        revision_number: int | None = None,
        trigger: str | None = None,
        remarks: str | None = None,
        block_order: list[str] | None = None,
        changed_block_ids: list[str] | None = None,
        structure_changed: bool = False,
        author_role: str | None = None,
        blocks: list | None = None,
        allow_overwrite: bool = False,
    ) -> dict:
        """Create an immutable revision record inside journal_versions."""
        latest = await self.find_one(
            {"journalId": journal_id},
            sort=[("revisionNumber", -1)],
        )

        if revision_number is None:
            revision_number = (latest.get("revisionNumber", 0) + 1) if latest else 1
        elif not allow_overwrite:
            existing = await self.find_one(
                {"journalId": journal_id, "revisionNumber": revision_number}
            )
            if existing:
                revision_number = (latest.get("revisionNumber", 0) + 1) if latest else (revision_number + 1)

        version_doc = {
            "journalId": journal_id,
            "authorId": author_id,
            "authorRole": author_role or "student",
            "revisionNumber": revision_number,
            "title": title,
            "status": status,
            "trigger": trigger,
            "remarks": remarks,
            "blockOrder": block_order if block_order is not None else [],
            "changedBlockIds": changed_block_ids if changed_block_ids is not None else [],
            "structureChanged": structure_changed,
            "schemaVersion": 1,
            "createdAt": datetime.now(timezone.utc),
        }
        # Legacy backward-compatibility: store full blocks only if explicitly supplied
        if blocks is not None:
            version_doc["blocks"] = blocks

        if allow_overwrite:
            await self.update_one(
                {"journalId": journal_id, "revisionNumber": revision_number},
                {"$set": version_doc},
                upsert=True,
            )
            return await self.find_one({"journalId": journal_id, "revisionNumber": revision_number})

        version_id = await self.insert_one(version_doc)
        return await self.find_by_id(version_id)

    async def create_snapshot(
        self,
        journal_id: str,
        author_id: str,
        status: str,
        blocks: list,
        title: str,
        revision_number: int | None = None,
        remarks: str | None = None,
        trigger: str | None = None,
        changed_block_ids: list[str] | None = None,
        structure_changed: bool = False,
        author_role: str | None = None,
        include_blocks: bool = False,
        allow_overwrite: bool = False,
        **kwargs,
    ) -> dict:
        """Backward-compatible snapshot creation.

        Derives block_order from blocks and stores the revision metadata.
        """
        block_order = [b["id"] for b in blocks if isinstance(b, dict) and "id" in b]
        return await self.create_version_record(
            journal_id=journal_id,
            author_id=author_id,
            status=status,
            title=title,
            revision_number=revision_number,
            trigger=trigger or "snapshot",
            remarks=remarks,
            block_order=block_order,
            changed_block_ids=changed_block_ids or [],
            structure_changed=structure_changed,
            author_role=author_role,
            blocks=blocks if include_blocks else None,
            allow_overwrite=allow_overwrite,
        )

    async def find_by_revision(self, journal_id: str, revision_number: int) -> dict | None:
        """Find a specific revision record by journalId and revisionNumber."""
        return await self.find_one(
            {"journalId": journal_id, "revisionNumber": revision_number}
        )

    async def find_version_metadata(self, journal_id: str) -> list[dict]:
        """Find lightweight timeline metadata for all revisions of a journal.

        Omits the heavy 'blocks' field to minimize network payload on timeline fetch.
        """
        projection = {"blocks": 0}
        return await self.find_many(
            {"journalId": journal_id},
            projection=projection,
            sort=[("revisionNumber", -1)],
        )

    async def get_latest_revision_number(self, journal_id: str) -> int:
        """Find the highest existing revision number for a journal."""
        latest = await self.find_one(
            {"journalId": journal_id},
            sort=[("revisionNumber", -1)],
        )
        if not latest:
            return 0
        return latest.get("revisionNumber", 0)

    async def find_journal_versions(self, journal_id: str) -> list[dict]:
        """Find all historical revision records for a journal, ordered chronologically."""
        return await self.find_many(
            {"journalId": journal_id},
            sort=[("revisionNumber", -1)],
        )

    async def find_latest_submission_snapshot(self, journal_id: str) -> dict | None:
        """Find the latest submitted/resubmitted immutable snapshot for a journal."""
        return await self.find_one(
            {"journalId": journal_id, "status": {"$in": ["submitted", "late_submitted"]}},
            sort=[("createdAt", -1)],
        )

    async def update_version_status(
        self,
        journal_id: str,
        revision_number: int,
        status: str,
        extra_fields: dict | None = None,
    ) -> bool:
        """Update the lifecycle status of a specific revision (e.g. mark as revoked or past_submitted)."""
        update_doc = {"status": status}
        if extra_fields:
            update_doc.update(extra_fields)
        return await self.update_one(
            {"journalId": journal_id, "revisionNumber": revision_number},
            {"$set": update_doc},
        )

    async def mark_prior_submissions_past(
        self, journal_id: str, current_revision: int
    ) -> int:
        """Transition any older active 'submitted' records to 'past_submitted'."""
        query = {
            "journalId": journal_id,
            "revisionNumber": {"$lt": current_revision},
            "status": {"$in": ["submitted", "late_submitted"]},
        }
        return await self.update_many(
            query,
            {"$set": {"status": "past_submitted", "isPastSubmission": True}},
        )
