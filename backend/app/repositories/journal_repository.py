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
                },
                "$inc": {"currentVersion": 1},
            },
        )

    async def update_single_block_with_revision(
        self, journal_id: str, block_id: str, new_content: dict, expected_revision: int
    ) -> dict | None:
        """Atomically update content of a single block with optimistic revision checking."""
        now = datetime.now(timezone.utc)
        query = {
            "_id": self._to_object_id(journal_id),
            "blocks.id": block_id,
            "$or": [
                {"currentVersion": expected_revision},
                {"currentVersion": {"$exists": False}},
            ],
        }
        update = {
            "$set": {
                "blocks.$.content": new_content,
                "blocks.$.metadata.updatedAt": now.isoformat().replace("+00:00", "Z"),
                "updatedAt": now,
            },
            "$inc": {"currentVersion": 1},
        }
        result = self.collection.find_one_and_update(
            query, update, return_document=True
        )
        return self._to_str_id(result)

    async def update_blocks_batch_with_revision(
        self,
        journal_id: str,
        blocks: list,
        expected_revision: int,
        title: str | None = None,
    ) -> dict | None:
        """Atomically update blocks array and optional title with optimistic revision checking."""
        now = datetime.now(timezone.utc)
        query = {
            "_id": self._to_object_id(journal_id),
            "$or": [
                {"currentVersion": expected_revision},
                {"currentVersion": {"$exists": False}},
            ],
        }
        set_fields = {
            "blocks": blocks,
            "updatedAt": now,
        }
        if title is not None:
            set_fields["title"] = title

        update = {
            "$set": set_fields,
            "$inc": {"currentVersion": 1},
        }
        result = self.collection.find_one_and_update(
            query, update, return_document=True
        )
        return self._to_str_id(result)

    async def update_block_order_with_revision(
        self, journal_id: str, block_order: list[str], expected_revision: int
    ) -> dict | None:
        """Atomically reorder blocks array based on ordered list of block IDs."""
        journal = await self.find_by_id(journal_id)
        if not journal:
            return None

        existing_blocks_map = {b["id"]: b for b in journal.get("blocks", [])}
        reordered_blocks = [
            existing_blocks_map[b_id]
            for b_id in block_order
            if b_id in existing_blocks_map
        ]
        # Include any block missing from block_order to avoid data loss
        for b in journal.get("blocks", []):
            if b["id"] not in existing_blocks_map:
                reordered_blocks.append(b)

        return await self.update_blocks_batch_with_revision(
            journal_id, reordered_blocks, expected_revision
        )

