"""Unit tests for Classroom Announcements and In-App Notifications."""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.schemas.announcement import AnnouncementCreateRequest
from app.services.announcement_service import AnnouncementService


@pytest.mark.anyio
@patch("app.services.announcement_service.AnnouncementRepository")
@patch("app.services.announcement_service.ClassroomRepository")
@patch("app.services.announcement_service.UserRepository")
@patch("app.services.announcement_service.ClassroomMembershipRepository")
@patch("app.services.announcement_service.NotificationRepository")
async def test_create_announcement_service(
    mock_notif_repo, mock_member_repo, mock_user_repo, mock_classroom_repo, mock_announcement_repo
):
    """Verify teacher can post announcement and async notification task is queued."""
    announcement_repo_inst = MagicMock()
    announcement_repo_inst.create_announcement = AsyncMock(
        return_value={
            "id": "ann_123",
            "classroomId": "class_123",
            "authorId": "teacher_123",
            "authorName": "Prof. Smith",
            "title": "Lab Exam Schedule",
            "content": "Exams for Batch A1 start next week.",
            "targetBatch": "Batch A1",
        }
    )
    mock_announcement_repo.return_value = announcement_repo_inst

    classroom_repo_inst = MagicMock()
    classroom_repo_inst.find_by_id = AsyncMock(
        return_value={"id": "class_123", "name": "OS Lab", "teacherId": "teacher_123"}
    )
    mock_classroom_repo.return_value = classroom_repo_inst

    user_repo_inst = MagicMock()
    user_repo_inst.find_by_id = AsyncMock(return_value={"id": "teacher_123", "name": "Prof. Smith"})
    mock_user_repo.return_value = user_repo_inst

    service = AnnouncementService()
    background_tasks = MagicMock()
    background_tasks.add_task = MagicMock()

    payload = AnnouncementCreateRequest(
        title="Lab Exam Schedule",
        content="Exams for Batch A1 start next week.",
        targetBatch="Batch A1",
    )

    result = await service.create_announcement("class_123", "teacher_123", payload, background_tasks)

    assert result["id"] == "ann_123"
    assert result["title"] == "Lab Exam Schedule"
    assert background_tasks.add_task.called
