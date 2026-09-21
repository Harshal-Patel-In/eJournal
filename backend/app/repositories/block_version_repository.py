"""Repository class managing immutable Journal Block Version Deltas inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
RULE-VH01: Historical revisions must remain immutable.
"""

from datetime import datetime, timezone
from pymongo import UpdateOne
from app.repositories.base import BaseRepository


class BlockVersionRepository(BaseRepository):
    """Journal block versions database access repository."""

    collection_name = "journal_block_versions"

    async def insert_block_deltas(self, deltas: list[dict]) -> int:
        """Batch-insert block delta records.

        Uses bulk_write with upsert=True on compound key (journalId, blockId, revisionNumber)
        to guarantee idempotency and crash resilience.
        """
        if not deltas:
            return 0

        operations = []
        for delta in deltas:
            doc = {
                "journalId": delta["journalId"],
                "blockId": delta["blockId"],
                "revisionNumber": delta["revisionNumber"],
                "operation": delta.get("operation", "update"),
                "type": delta.get("type", "paragraph"),
                "content": delta.get("content", {}),
                "metadata": delta.get("metadata", {}),
                "contentHash": delta.get("contentHash", ""),
                "createdAt": delta.get("createdAt", datetime.now(timezone.utc)),
            }
            filter_query = {
                "journalId": doc["journalId"],
                "blockId": doc["blockId"],
                "revisionNumber": doc["revisionNumber"],
            }
            operations.append(
                UpdateOne(filter_query, {"$set": doc}, upsert=True)
            )

        result = self.collection.bulk_write(operations, ordered=False)
        return result.upserted_count + result.inserted_count

    async def get_blocks_for_revision(
        self, journal_id: str, block_ids: list[str], max_revision: int
    ) -> list[dict]:
        """Resolve latest block states for a given journal revision.

        Executes an index-aligned streaming aggregation pipeline:
        1. $match on journalId, blockId in block_ids, revisionNumber <= max_revision
        2. $sort on blockId ASC, revisionNumber DESC (matches compound index prefix)
        3. $group on blockId taking $first to pick the newest revision <= max_revision
        """
        if not block_ids:
            return []

        pipeline = [
            {
                "$match": {
                    "journalId": journal_id,
                    "blockId": {"$in": block_ids},
                    "revisionNumber": {"$lte": max_revision},
                }
            },
            {
                "$sort": {
                    "blockId": 1,
                    "revisionNumber": -1,
                }
            },
            {
                "$group": {
                    "_id": "$blockId",
                    "blockId": {"$first": "$blockId"},
                    "type": {"$first": "$type"},
                    "content": {"$first": "$content"},
                    "metadata": {"$first": "$metadata"},
                    "operation": {"$first": "$operation"},
                    "revisionNumber": {"$first": "$revisionNumber"},
                    "contentHash": {"$first": "$contentHash"},
                }
            },
        ]

        cursor = self.collection.aggregate(pipeline)
        docs = list(cursor)
        return [self._to_str_id(d) for d in docs]

    async def explain_reconstruction_query(
        self, journal_id: str, block_ids: list[str], max_revision: int
    ) -> dict:
        """Run .explain('executionStats') on the reconstruction aggregation pipeline."""
        if not block_ids:
            return {}

        pipeline = [
            {
                "$match": {
                    "journalId": journal_id,
                    "blockId": {"$in": block_ids},
                    "revisionNumber": {"$lte": max_revision},
                }
            },
            {
                "$sort": {
                    "blockId": 1,
                    "revisionNumber": -1,
                }
            },
            {
                "$group": {
                    "_id": "$blockId",
                    "blockId": {"$first": "$blockId"},
                    "type": {"$first": "$type"},
                    "content": {"$first": "$content"},
                    "metadata": {"$first": "$metadata"},
                    "operation": {"$first": "$operation"},
                    "revisionNumber": {"$first": "$revisionNumber"},
                }
            },
        ]

        # PyMongo command for explain
        db = self.collection.database
        explain_cmd = {
            "explain": {
                "aggregate": self.collection_name,
                "pipeline": pipeline,
                "cursor": {},
            },
            "verbosity": "executionStats",
        }
        return db.command(explain_cmd)

    async def find_deltas_for_revision(
        self, journal_id: str, revision_number: int
    ) -> list[dict]:
        """Fetch all block deltas created at a specific revision number."""
        docs = self.collection.find(
            {"journalId": journal_id, "revisionNumber": revision_number}
        )
        return [self._to_str_id(d) for d in docs]

    async def delete_by_journal_id(self, journal_id: str) -> int:
        """Remove all block versions for a journal (used in cleanup/testing)."""
        result = self.collection.delete_many({"journalId": journal_id})
        return result.deleted_count
