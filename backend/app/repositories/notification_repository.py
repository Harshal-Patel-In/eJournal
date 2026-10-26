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
        entity_type: str | None = None,
        entity_id: str | None = None,
        sub_entity_id: str | None = None,
        classroom_id: str | None = None,
        category: str | None = None,
    ) -> dict:
        """Create a new user notification and return the created record."""
        now = datetime.now(timezone.utc)
        meta = metadata or {}
        ent_type = entity_type or meta.get("entityType")
        ent_id = entity_id or meta.get("entityId") or meta.get("journalId") or meta.get("assignmentId")
        sub_ent_id = sub_entity_id or meta.get("subEntityId") or meta.get("blockId")
        cls_id = classroom_id or meta.get("classroomId")
        cat = category or meta.get("category") or type_str

        doc = {
            "userId": user_id,
            "title": title,
            "message": message,
            "type": type_str,
            "isRead": False,
            "link": link,
            "metadata": meta,
            "entityType": ent_type,
            "entityId": ent_id,
            "subEntityId": sub_ent_id,
            "classroomId": cls_id,
            "category": cat,
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
        entity_type: str | None = None,
        entity_id: str | None = None,
        sub_entity_id: str | None = None,
        classroom_id: str | None = None,
        category: str | None = None,
    ) -> list[dict]:
        """Create notifications for multiple users efficiently."""
        if not user_ids:
            return []
        now = datetime.now(timezone.utc)
        meta = metadata or {}
        ent_type = entity_type or meta.get("entityType")
        ent_id = entity_id or meta.get("entityId") or meta.get("journalId") or meta.get("assignmentId")
        sub_ent_id = sub_entity_id or meta.get("subEntityId") or meta.get("blockId")
        cls_id = classroom_id or meta.get("classroomId")
        cat = category or meta.get("category") or type_str

        docs = [
            {
                "userId": uid,
                "title": title,
                "message": message,
                "type": type_str,
                "isRead": False,
                "link": link,
                "metadata": meta,
                "entityType": ent_type,
                "entityId": ent_id,
                "subEntityId": sub_ent_id,
                "classroomId": cls_id,
                "category": cat,
                "createdAt": now,
            }
            for uid in user_ids
        ]
        result = await self.collection.insert_many(docs)
        for i, doc in enumerate(docs):
            doc["id"] = str(result.inserted_ids[i])
        return docs

    async def find_by_user_id(self, user_id: str, limit: int = 50) -> list[dict]:
        """Fetch notifications for a user, sorted by most recent first."""
        cursor = self.collection.find({"userId": user_id}).sort([("createdAt", -1)]).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [self._to_str_id(doc) for doc in docs]

    async def mark_as_read(self, notification_id: str, user_id: str | None = None) -> bool:
        """Mark a notification as read and record readAt timestamp for 7-day TTL cleanup.

        Strictly scopes the update to the owning user_id if provided (SEC-01).
        """
        if not notification_id:
            return False
        now = datetime.now(timezone.utc)
        if not user_id:
            return await self.update_by_id(
                notification_id,
                {"$set": {"isRead": True, "readAt": now, "updatedAt": now}},
            )
        from bson import ObjectId
        query: dict = {"_id": ObjectId(notification_id)} if ObjectId.is_valid(notification_id) else {"_id": notification_id}
        query["userId"] = str(user_id)
        result = await self.collection.update_one(
            query,
            {"$set": {"isRead": True, "readAt": now, "updatedAt": now}},
        )
        return result.modified_count > 0 if hasattr(result, "modified_count") else True

    async def mark_all_as_read(self, user_id: str) -> bool:
        """Mark all notifications for a user as read and record readAt timestamp for 7-day TTL cleanup."""
        now = datetime.now(timezone.utc)
        result = await self.collection.update_many(
            {"userId": user_id, "isRead": False},
            {"$set": {"isRead": True, "readAt": now, "updatedAt": now}},
        )
        return result.modified_count > 0
