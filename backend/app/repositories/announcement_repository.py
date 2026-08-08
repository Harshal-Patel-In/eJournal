"""Repository class managing Announcement persistence in MongoDB."""

from app.repositories.base import BaseRepository


class AnnouncementRepository(BaseRepository):
    """Announcement database operations."""

    collection_name = "announcements"

    async def create_announcement(self, data: dict) -> dict:
        """Create a new classroom announcement document."""
        announcement_id = await self.insert_one(data)
        return await self.find_by_id(announcement_id)

    async def find_classroom_announcements(self, classroom_id: str, batch: str | None = None) -> list[dict]:
        """List announcements for a classroom, optionally filtered by targetBatch."""
        query: dict = {"classroomId": classroom_id}
        if batch:
            query["$or"] = [{"targetBatch": None}, {"targetBatch": batch}]
        return await self.find_many(query, sort=[("createdAt", -1)])
