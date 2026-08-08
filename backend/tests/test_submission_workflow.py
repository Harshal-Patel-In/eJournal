"""Unit tests for Submission, Revocation, Late Tagging, and Approved Lock Engine."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.schemas.journal import SingleBlockUpdateRequest
from app.services.journal_service import JournalService


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_unsubmit_before_deadline_success(
    mock_audit, mock_version, mock_assignment, mock_journal
):
    """Verify student can unsubmit before deadline, setting isRevoked=True."""
    now = datetime.now(timezone.utc)
    future_deadline = (now + timedelta(days=2)).isoformat()

    journal_inst = MagicMock()
    journal_inst.find_by_id = AsyncMock(
        side_effect=[
            {
                "id": "jour_123",
                "studentId": "student_123",
                "assignmentId": "asg_123",
                "status": "submitted",
                "blocks": [],
            },
            {
                "id": "jour_123",
                "studentId": "student_123",
                "assignmentId": "asg_123",
                "status": "draft",
                "isRevoked": True,
                "blocks": [],
            },
        ]
    )
    journal_inst.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_inst

    asg_inst = MagicMock()
    asg_inst.find_by_id = AsyncMock(return_value={"id": "asg_123", "deadline": future_deadline})
    mock_assignment.return_value = asg_inst

    version_inst = MagicMock()
    version_inst.create_version = AsyncMock(return_value="ver_123")
    mock_version.return_value = version_inst

    audit_inst = MagicMock()
    audit_inst.log_event = AsyncMock()
    mock_audit.return_value = audit_inst

    service = JournalService()
    result = await service.unsubmit_journal("jour_123", "student_123")

    assert result["status"] == "draft"
    assert result["isRevoked"] is True
    assert journal_inst.update_by_id.called


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
async def test_unsubmit_after_deadline_fails(mock_assignment, mock_journal):
    """Verify unsubmit fails with 400 INVALID_WORKFLOW_STATE after deadline."""
    now = datetime.now(timezone.utc)
    past_deadline = (now - timedelta(hours=2)).isoformat()

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

    asg_inst = MagicMock()
    asg_inst.find_by_id = AsyncMock(return_value={"id": "asg_123", "deadline": past_deadline})
    mock_assignment.return_value = asg_inst

    service = JournalService()

    with pytest.raises(AppException) as exc_info:
        await service.unsubmit_journal("jour_123", "student_123")

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == ErrorCode.INVALID_WORKFLOW_STATE


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
async def test_update_block_on_approved_journal_fails(mock_journal):
    """Verify modifying block on approved journal fails with 400 INVALID_WORKFLOW_STATE."""
    journal_inst = MagicMock()
    journal_inst.find_by_id = AsyncMock(
        return_value={
            "id": "jour_123",
            "studentId": "student_123",
            "status": "approved",
            "blocks": [{"id": "b1", "type": "paragraph", "content": {}}],
        }
    )
    mock_journal.return_value = journal_inst

    service = JournalService()
    req = SingleBlockUpdateRequest(content={"text": "Edit text"}, clientRevision=1)

    with pytest.raises(AppException) as exc_info:
        await service.update_single_block("jour_123", "student_123", "b1", req)

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == ErrorCode.INVALID_WORKFLOW_STATE
