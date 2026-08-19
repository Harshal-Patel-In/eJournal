"""Repository class managing user in-app notifications in MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository):
    """Notification database access repository."""

    collection_name = "notifications"

    async def create_notification(
        self,
        user_id: str,
        title: str,
        message: str,
        type_str: str,
        link: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """Create a new user notification and return the created record."""
        now = datetime.now(timezone.utc)
        doc = {
            "userId": user_id,
            "title": title,
            "message": message,
            "type": type_str,
            "isRead": False,
            "link": link,
            "metadata": metadata or {},
            "createdAt": now,
        }
        notif_id = await self.insert_one(doc)
        doc["id"] = notif_id
        return doc

    async def create_many_notifications(
        self,
        user_ids: list[str],
        title: str,
        message: str,
        type_str: str,
        link: str | None = None,
        metadata: dict | None = None,
    ) -> list[dict]:
        """Create notifications for multiple users efficiently."""
        if not user_ids:
            return []
        now = datetime.now(timezone.utc)
        docs = [
            {
                "userId": uid,
                "title": title,
                "message": message,
                "type": type_str,
                "isRead": False,
                "link": link,
                "metadata": metadata or {},
                "createdAt": now,
            }
            for uid in user_ids
        ]
        result = self.collection.insert_many(docs)
        for i, doc in enumerate(docs):
            doc["id"] = str(result.inserted_ids[i])
        return docs

    async def find_by_user_id(self, user_id: str, limit: int = 50) -> list[dict]:
        """Fetch notifications for a user, sorted by most recent first."""
        cursor = self.collection.find({"userId": user_id}).sort([("createdAt", -1)]).limit(limit)
        return [self._to_str_id(doc) for doc in cursor]

    async def mark_as_read(self, notification_id: str) -> bool:
        """Mark a notification as read."""
        return await self.update_by_id(notification_id, {"$set": {"isRead": True}})

    async def mark_all_as_read(self, user_id: str) -> bool:
        """Mark all notifications for a user as read."""
        result = self.collection.update_many(
            {"userId": user_id, "isRead": False},
            {"$set": {"isRead": True}}
        )
        return result.modified_count > 0
