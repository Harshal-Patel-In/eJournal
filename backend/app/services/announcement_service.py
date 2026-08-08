"""Classroom Announcement and Notification dispatch service."""

from datetime import datetime, timezone
from fastapi import BackgroundTasks, status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.announcement_repository import AnnouncementRepository
from app.repositories.classroom_membership_repository import ClassroomMembershipRepository
from app.repositories.classroom_repository import ClassroomRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.announcement import AnnouncementCreateRequest


class AnnouncementService:
    """Announcement business logic service."""

    def __init__(self):
        self.announcement_repo = AnnouncementRepository()
        self.classroom_repo = ClassroomRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.notification_repo = NotificationRepository()
        self.user_repo = UserRepository()

    async def _async_dispatch_announcement_notifications(
        self, classroom_id: str, classroom_name: str, announcement_title: str, target_batch: str | None
    ):
        """Background task: Bulk dispatch in-app notifications to enrolled students."""
        memberships = await self.membership_repo.find_many({"classroomId": classroom_id, "status": "active"})
        if not memberships:
            return

        notif_docs = []
        now = datetime.now(timezone.utc)
        for m in memberships:
            student_id = m.get("studentId")
            if not student_id:
                continue
            notif_docs.append(
                {
                    "userId": student_id,
                    "title": f"Announcement in {classroom_name}",
                    "message": announcement_title,
                    "type": "announcement",
                    "link": f"/classrooms/{classroom_id}",
                    "isRead": False,
                    "createdAt": now,
                }
            )

        if notif_docs:
            await self.notification_repo.insert_many(notif_docs)

    async def create_announcement(
        self,
        classroom_id: str,
        teacher_id: str,
        payload: AnnouncementCreateRequest,
        background_tasks: BackgroundTasks,
    ) -> dict:
        """Create announcement and queue async notification dispatch (Teacher only)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if classroom.get("teacherId") != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Only the classroom teacher can post announcements",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        teacher = await self.user_repo.find_by_id(teacher_id)
        teacher_name = teacher.get("name", "Teacher") if teacher else "Teacher"

        announcement_doc = {
            "classroomId": classroom_id,
            "authorId": teacher_id,
            "authorName": teacher_name,
            "title": payload.title.strip(),
            "content": payload.content.strip(),
            "targetBatch": payload.targetBatch.strip() if payload.targetBatch else None,
            "createdAt": datetime.now(timezone.utc),
        }

        created = await self.announcement_repo.create_announcement(announcement_doc)

        # Queue non-blocking async background bulk notification dispatch
        background_tasks.add_task(
            self._async_dispatch_announcement_notifications,
            classroom_id=classroom_id,
            classroom_name=classroom.get("name", "Classroom"),
            announcement_title=payload.title.strip(),
            target_batch=payload.targetBatch,
        )

        return created

    async def list_announcements(self, classroom_id: str, user: dict) -> list[dict]:
        """List announcements for classroom members."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Filter by student batch if available
        batch = None
        if user.get("role") == "student":
            profile = user.get("profile", {})
            batch = profile.get("batch")

        return await self.announcement_repo.find_classroom_announcements(classroom_id, batch=batch)
