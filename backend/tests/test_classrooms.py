"""Unit and Integration tests for Classroom and Membership operations.

RULE-TEST01: Unit tests cover service-layer rules, permission checks, workflow state.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.constants import ErrorCode
from app.schemas.classroom import ClassroomCreateRequest
from app.services.classroom_service import ClassroomService


# 1. Test classroom creation
@pytest.mark.anyio
@patch("app.services.classroom_service.ClassroomRepository")
@patch("app.services.classroom_service.AuditLogRepository")
async def test_create_classroom_service(mock_audit_repo, mock_classroom_repo):
    """Test teacher creating a classroom and generating unique joinCode."""
    classroom_repo_instance = MagicMock()
    classroom_repo_instance.is_join_code_exists = AsyncMock(return_value=False)
    classroom_repo_instance.insert_one = AsyncMock(return_value="classroom_123")
    classroom_repo_instance.find_by_id = AsyncMock(
        return_value={
            "id": "classroom_123",
            "name": "Operating Systems Space",
            "subject": "CS401",
            "semester": "Semester V",
            "division": "Division A",
            "department": "Computer Science",
            "teacherId": "teacher_123",
            "joinCode": "CS401-ABCD",
        }
    )
    mock_classroom_repo.return_value = classroom_repo_instance

    audit_repo_instance = MagicMock()
    audit_repo_instance.log_event = AsyncMock()
    mock_audit_repo.return_value = audit_repo_instance

    classroom_service = ClassroomService()

    payload = ClassroomCreateRequest(
        name="Operating Systems Space",
        subject="CS401",
        semester="Semester V",
        division="Division A",
        department="Computer Science",
    )

    result = await classroom_service.create_classroom("teacher_123", payload)

    assert result["id"] == "classroom_123"
    assert result["joinCode"].startswith("CS401-")
    assert classroom_repo_instance.insert_one.called
    assert audit_repo_instance.log_event.called


# 2. Test student joining a classroom
@pytest.mark.anyio
@patch("app.services.classroom_service.ClassroomRepository")
@patch("app.services.classroom_service.ClassroomMembershipRepository")
@patch("app.services.classroom_service.AuditLogRepository")
async def test_join_classroom_service(
    mock_audit_repo, mock_membership_repo, mock_classroom_repo
):
    """Test student enrolling in classroom and compound unique enrollment checks."""
    classroom_repo_instance = MagicMock()
    classroom_doc = {
        "id": "classroom_123",
        "name": "Operating Systems Space",
        "subject": "CS401",
        "teacherId": "teacher_123",
        "joinCode": "CS401-ABCD",
    }
    classroom_repo_instance.find_by_join_code = AsyncMock(return_value=classroom_doc)
    mock_classroom_repo.return_value = classroom_repo_instance

    membership_repo_instance = MagicMock()
    # Mocking first join: not enrolled yet
    membership_repo_instance.is_member = AsyncMock(return_value=False)
    membership_repo_instance.add_member = AsyncMock(return_value="membership_123")
    mock_membership_repo.return_value = membership_repo_instance

    audit_repo_instance = MagicMock()
    audit_repo_instance.log_event = AsyncMock()
    mock_audit_repo.return_value = audit_repo_instance

    classroom_service = ClassroomService()

    # Successful join
    result = await classroom_service.join_classroom("student_123", "CS401-ABCD")
    assert result["id"] == "classroom_123"
    assert membership_repo_instance.add_member.called

    # Mocking duplicate join (should raise error)
    membership_repo_instance.is_member = AsyncMock(return_value=True)
    with pytest.raises(Exception) as exc_info:
        await classroom_service.join_classroom("student_123", "CS401-ABCD")
    assert getattr(exc_info.value, "code") == ErrorCode.ALREADY_ENROLLED
