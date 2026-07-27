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
        self, user_id: str, title: str, message: str, type_str: str, link: str | None = None
    ) -> str:
        """Create a new user notification."""
        doc = {
            "userId": user_id,
            "title": title,
            "message": message,
            "type": type_str,
            "isRead": False,
            "link": link,
            "createdAt": datetime.now(timezone.utc),
        }
        return await self.insert_one(doc)

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
