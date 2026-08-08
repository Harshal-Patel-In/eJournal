"""Unit tests for Student & Classroom Batch Routing."""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.schemas.classroom import ClassroomCreateRequest
from app.services.classroom_service import ClassroomService


@pytest.mark.anyio
@patch("app.services.classroom_service.ClassroomRepository")
@patch("app.services.classroom_service.AuditLogRepository")
async def test_create_classroom_with_batches(mock_audit_repo, mock_classroom_repo):
    """Verify teacher can create classroom with batches list."""
    classroom_repo_instance = MagicMock()
    classroom_repo_instance.is_join_code_exists = AsyncMock(return_value=False)
    classroom_repo_instance.insert_one = AsyncMock(return_value="class_batch_123")
    classroom_repo_instance.find_by_id = AsyncMock(
        return_value={
            "id": "class_batch_123",
            "name": "Data Structures",
            "subject": "CS201",
            "semester": "Semester 3",
            "division": "A",
            "department": "Computer Science",
            "teacherId": "teacher_123",
            "joinCode": "CS201-B123",
            "batches": ["Batch A1", "Batch A2", "Batch B1"],
        }
    )
    mock_classroom_repo.return_value = classroom_repo_instance

    audit_repo_instance = MagicMock()
    audit_repo_instance.log_event = AsyncMock()
    mock_audit_repo.return_value = audit_repo_instance

    classroom_service = ClassroomService()

    payload = ClassroomCreateRequest(
        name="Data Structures",
        subject="CS201",
        semester="Semester 3",
        division="A",
        department="Computer Science",
        batches=["Batch A1", "Batch A2", "Batch B1"],
    )

    result = await classroom_service.create_classroom("teacher_123", payload)

    assert result["id"] == "class_batch_123"
    assert "Batch A1" in result["batches"]
    assert "Batch B1" in result["batches"]
