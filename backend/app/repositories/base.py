"""Base repository class with common MongoDB operations.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
RULE-BE09: Convert _id to API-safe strings.
RULE-DB12: Prefer single-document atomic updates.
"""

from typing import Any

from bson import ObjectId
from pymongo.collection import Collection

from app.core.database import get_collection


class BaseRepository:
    """Base repository providing common MongoDB operations.

    Each concrete repository extends this class and sets `collection_name`.
    """

    collection_name: str = ""

    @property
    def collection(self) -> Collection:
        """Get the MongoDB collection for this repository."""
        if not self.collection_name:
            raise ValueError("collection_name must be set on the repository subclass")
        return get_collection(self.collection_name)

    @staticmethod
    def _to_str_id(doc: dict | None) -> dict | None:
        """Convert MongoDB _id (ObjectId) to string 'id' field.

        RULE-BE09: Convert _id to API-safe strings.
        """
        if doc is None:
            return None
        doc["id"] = str(doc.pop("_id"))
        return doc

    @staticmethod
    def _to_object_id(id_str: str) -> ObjectId:
        """Convert string ID to ObjectId for queries."""
        if not id_str or not ObjectId.is_valid(id_str):
            raise ValueError(f"Invalid ObjectId string: {id_str}")
        return ObjectId(id_str)

    async def find_by_id(self, id_str: str) -> dict | None:
        """Find a document by its ID."""
        if not id_str or not ObjectId.is_valid(id_str):
            return None
        doc = self.collection.find_one({"_id": ObjectId(id_str)})
        return self._to_str_id(doc)

    async def find_one(
        self,
        filter: dict,
        projection: dict | None = None,
        sort: list[tuple[str, int]] | None = None,
    ) -> dict | None:
        """Find a single document matching the filter."""
        if sort:
            doc = self.collection.find_one(filter, projection, sort=sort)
        else:
            doc = self.collection.find_one(filter, projection)
        return self._to_str_id(doc)

    async def find_many(
        self,
        filter: dict,
        projection: dict | None = None,
        sort: list[tuple[str, int]] | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        """Find multiple documents with pagination."""
        cursor = self.collection.find(filter, projection)
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.skip(skip).limit(limit)
        return [self._to_str_id(doc) for doc in cursor]

    async def count(self, filter: dict) -> int:
        """Count documents matching the filter."""
        return self.collection.count_documents(filter)

    async def insert_one(self, document: dict) -> str:
        """Insert a document and return its string ID."""
        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    async def insert_many(self, documents: list[dict]) -> list[str]:
        """Insert multiple documents and return list of string IDs."""
        if not documents:
            return []
        result = self.collection.insert_many(documents)
        return [str(inserted_id) for inserted_id in result.inserted_ids]

    async def update_one(
        self, filter: dict, update: dict, upsert: bool = False
    ) -> bool:
        """Update a single document. Returns True if matched."""
        result = self.collection.update_one(filter, update, upsert=upsert)
        return result.matched_count > 0

    async def update_by_id(self, id_str: str, update: dict) -> bool:
        """Update a document by its ID."""
        return await self.update_one(
            {"_id": self._to_object_id(id_str)}, update
        )

    async def delete_one(self, filter: dict) -> bool:
        """Delete a single document. Returns True if deleted."""
        result = self.collection.delete_one(filter)
        return result.deleted_count > 0

    async def delete_by_id(self, id_str: str) -> bool:
        """Delete a document by its ID."""
        return await self.delete_one({"_id": self._to_object_id(id_str)})
