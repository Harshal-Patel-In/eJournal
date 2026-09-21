"""Asset repository for uploaded documents/images and recycle bin lifecycle.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
RULE-BE09: Convert _id to API-safe strings.
"""

from datetime import datetime, timezone, timedelta
from bson import ObjectId
from app.repositories.base import BaseRepository


class AssetRepository(BaseRepository):
    collection_name = "uploaded_assets"

    async def create_asset(
        self,
        user_id: str,
        url: str,
        public_id: str | None = None,
        filename: str = "",
        size: int = 0,
        content_type: str = "image",
    ) -> dict:
        """Register a newly uploaded asset."""
        now = datetime.now(timezone.utc)
        doc = {
            "userId": user_id,
            "url": url,
            "publicId": public_id,
            "filename": filename,
            "size": size,
            "contentType": content_type,
            "isDeleted": False,
            "deletedAt": None,
            "createdAt": now,
            "updatedAt": now,
        }
        result = self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._to_str_id(doc)

    async def find_by_url(self, user_id: str, url: str) -> dict | None:
        """Find an asset by its URL for a specific user."""
        doc = self.collection.find_one({"userId": user_id, "url": url})
        return self._to_str_id(doc)

    async def move_to_trash(self, user_id: str, url: str) -> dict | None:
        """Move an asset to the recycle bin by setting isDeleted=True and deletedAt=now."""
        now = datetime.now(timezone.utc)
        doc = self.collection.find_one({"userId": user_id, "url": url})
        if doc:
            self.collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"isDeleted": True, "deletedAt": now, "updatedAt": now}},
            )
            doc["isDeleted"] = True
            doc["deletedAt"] = now
            return self._to_str_id(doc)
        else:
            # If asset was uploaded before tracking or via URL paste, create a trash record
            new_doc = {
                "userId": user_id,
                "url": url,
                "publicId": None,
                "filename": url.split("/")[-1].split("?")[0] or "image",
                "size": 0,
                "contentType": "image",
                "isDeleted": True,
                "deletedAt": now,
                "createdAt": now,
                "updatedAt": now,
            }
            res = self.collection.insert_one(new_doc)
            new_doc["_id"] = res.inserted_id
            return self._to_str_id(new_doc)

    async def restore_from_trash(self, user_id: str, asset_id: str) -> dict | None:
        """Restore an asset from the recycle bin."""
        if not ObjectId.is_valid(asset_id):
            return None
        now = datetime.now(timezone.utc)
        doc = self.collection.find_one({"_id": ObjectId(asset_id), "userId": user_id})
        if not doc:
            return None
        self.collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"isDeleted": False, "deletedAt": None, "updatedAt": now}},
        )
        doc["isDeleted"] = False
        doc["deletedAt"] = None
        return self._to_str_id(doc)

    async def get_trash(self, user_id: str) -> list[dict]:
        """Get all active trashed assets for user within 3-day retention period."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=3)
        cursor = self.collection.find({
            "userId": user_id,
            "isDeleted": True,
            "deletedAt": {"$gte": cutoff},
        }).sort([("deletedAt", -1)])

        docs = []
        now = datetime.now(timezone.utc)
        for d in cursor:
            item = self._to_str_id(d)
            if item and item.get("deletedAt"):
                deleted_at = item["deletedAt"]
                if deleted_at.tzinfo is None:
                    deleted_at = deleted_at.replace(tzinfo=timezone.utc)
                expires_at = deleted_at + timedelta(days=3)
                remaining_seconds = max(0, int((expires_at - now).total_seconds()))
                item["expiresAt"] = expires_at.isoformat()
                item["remainingSeconds"] = remaining_seconds
                item["daysRemaining"] = max(1, int((remaining_seconds + 86399) // 86400))
            docs.append(item)
        return docs

    async def get_expired_trash(self) -> list[dict]:
        """Find trashed assets older than 3 days for cloud permanent deletion."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=3)
        cursor = self.collection.find({
            "isDeleted": True,
            "deletedAt": {"$lt": cutoff},
        })
        return [self._to_str_id(d) for d in cursor]

    async def delete_permanently(self, user_id: str, asset_id: str) -> dict | None:
        """Delete an asset permanently from the database and return its metadata for cloud cleanup."""
        if not ObjectId.is_valid(asset_id):
            return None
        doc = self.collection.find_one({"_id": ObjectId(asset_id), "userId": user_id})
        if not doc:
            return None
        self.collection.delete_one({"_id": doc["_id"]})
        return self._to_str_id(doc)
