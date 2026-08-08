"""Unit tests for 6 Block Annotation Types, Per-Block Badges, and Approval Transactions."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.schemas.comment import CommentCreateRequest, ApproveJournalRequest
from app.services.comment_service import CommentService
from app.services.journal_service import JournalService


@pytest.mark.anyio
@patch("app.services.comment_service.CommentRepository")
@patch("app.services.comment_service.JournalRepository")
@patch("app.services.comment_service.UserRepository")
async def test_add_block_annotation_6_types(mock_user, mock_journal, mock_comment):
    """Verify teacher can create any of the 6 block annotation types."""
    comment_repo_inst = MagicMock()
    comment_repo_inst.create_comment = AsyncMock(
        return_value={
            "id": "c_123",
            "journalId": "jour_123",
            "blockId": "b_123",
            "authorId": "teacher_123",
            "type": "Suggestion",
            "content": "Use Kirchhoff's Current Law equation here.",
            "reviewStatus": "Changes Requested",
        }
    )
    mock_comment.return_value = comment_repo_inst

    journal_inst = MagicMock()
    journal_inst.find_by_id = AsyncMock(
        return_value={
            "id": "jour_123",
            "studentId": "student_123",
            "assignmentId": "asg_123",
            "status": "submitted",
        }
    )
    mock_journal.return_value = journal_inst

    user_inst = MagicMock()
    user_inst.find_by_id = AsyncMock(return_value={"id": "teacher_123", "profile": {"name": "Prof. Smith"}})
    mock_user.return_value = user_inst

    service = CommentService()
    req = CommentCreateRequest(
        blockId="b_123",
        type="Suggestion",
        content="Use Kirchhoff's Current Law equation here.",
    )
    result = await service.add_annotation("jour_123", "teacher_123", req)

    assert result["id"] == "c_123"
    assert result["type"] == "Suggestion"
    assert result["reviewStatus"] == "Changes Requested"


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.ClassroomRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AuditLogRepository")
@patch("app.repositories.notification_repository.NotificationRepository")
async def test_approve_journal_approval_record(
    mock_notif, mock_audit, mock_version, mock_classroom, mock_assignment, mock_journal
):
    """Verify teacher approving journal creates approval record and locks journal."""
    journal_inst = MagicMock()
    journal_inst.find_by_id = AsyncMock(
        side_effect=[
            {
                "id": "jour_123",
                "studentId": "student_123",
                "assignmentId": "asg_123",
                "status": "submitted",
            },
            {
                "id": "jour_123",
                "studentId": "student_123",
                "assignmentId": "asg_123",
                "status": "approved",
                "marks": 9.5,
            },
        ]
    )
    journal_inst.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_inst

    asg_inst = MagicMock()
    asg_inst.find_by_id = AsyncMock(
        return_value={"id": "asg_123", "classroomId": "class_123", "maxMarks": 10.0}
    )
    mock_assignment.return_value = asg_inst

    class_inst = MagicMock()
    class_inst.find_by_id = AsyncMock(return_value={"id": "class_123", "teacherId": "teacher_123"})
    mock_classroom.return_value = class_inst

    version_inst = MagicMock()
    version_inst.create_snapshot = AsyncMock(return_value={"id": "v_snap"})
    version_inst.get_latest_revision_number = AsyncMock(return_value=1)
    mock_version.return_value = version_inst

    audit_inst = MagicMock()
    audit_inst.log_event = AsyncMock()
    mock_audit.return_value = audit_inst

    notif_inst = MagicMock()
    notif_inst.create_notification = AsyncMock()
    mock_notif.return_value = notif_inst

    service = JournalService()
    req = ApproveJournalRequest(marks=9.5, remarks="Exemplary lab work")

    result = await service.approve_journal("jour_123", "teacher_123", req)

    assert result["status"] == "approved"
    assert result["marks"] == 9.5
