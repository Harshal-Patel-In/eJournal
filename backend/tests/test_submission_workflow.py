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


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_milestone_lifecycle_transitions_and_revocation(
    mock_audit, mock_version, mock_assignment, mock_journal
):
    """Verify submit calculates sequential milestone, marks prior submissions past_submitted, and unsubmit marks revoked."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_milestone_1",
            "studentId": "student_1",
            "assignmentId": "asg_1",
            "status": "draft",
            "title": "Lab 1",
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Hello"}}],
        }
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_1", "deadline": None})
    mock_assignment.return_value = asg_repo

    version_repo = MagicMock()
    version_repo.get_latest_revision_number = AsyncMock(return_value=1)
    version_repo.mark_prior_submissions_past = AsyncMock(return_value=1)
    version_repo.create_snapshot = AsyncMock(return_value={"id": "v2"})
    version_repo.update_version_status = AsyncMock(return_value=True)
    mock_version.return_value = version_repo

    mock_audit.return_value.log_event = AsyncMock()

    service = JournalService()

    # 1. Submit Journal
    await service.submit_journal("j_milestone_1", "student_1")
    assert version_repo.mark_prior_submissions_past.called
    assert version_repo.create_snapshot.called
    call_kwargs = version_repo.create_snapshot.call_args[1]
    assert call_kwargs["revision_number"] == 2
    assert call_kwargs["status"] == "submitted"

    # 2. Unsubmit Journal (reverts to draft and marks revision revoked)
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_milestone_1",
            "studentId": "student_1",
            "assignmentId": "asg_1",
            "status": "submitted",
            "blocks": [],
        }
    )
    await service.unsubmit_journal("j_milestone_1", "student_1")
    assert version_repo.update_version_status.called
    update_kwargs = version_repo.update_version_status.call_args[0]
    assert update_kwargs[1] == 1 or update_kwargs[1] == 2
    assert update_kwargs[2] == "revoked"


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.VersionRepository")
async def test_resolve_revision_fallback_active_draft(mock_version, mock_journal):
    """Verify that resolving an uncommitted draft revision gracefully returns the active draft without 404."""
    version_repo = MagicMock()
    version_repo.find_by_revision = AsyncMock(return_value=None)
    version_repo.find_one = AsyncMock(return_value=None)
    version_repo.get_latest_revision_number = AsyncMock(return_value=55)
    mock_version.return_value = version_repo

    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_active_draft",
            "currentVersion": 56,
            "title": "Active Working Title",
            "status": "draft",
            "blocks": [{"id": "b_code", "type": "code", "content": {"code": "print('hello')"}}],
        }
    )
    mock_journal.return_value = journal_repo

    service = JournalService()
    # When requesting revision 56 (which is > latest_recorded 55)
    res = await service.resolve_journal_revision("j_active_draft", 56)

    assert res is not None
    assert res["revisionNumber"] == 56
    assert res["status"] == "draft"
    assert len(res["blocks"]) == 1
    assert res["blocks"][0]["id"] == "b_code"


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_submit_initial_draft_finalizes_revision_one(
    mock_audit, mock_assignment, mock_version, mock_journal
):
    """Test 2.1: Submitting initial draft finalizes Revision 1 instead of bumping to Revision 2."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_init_1",
            "studentId": "student_1",
            "assignmentId": "asg_1",
            "status": "draft",
            "title": "Initial Lab Draft",
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Initial text"}}],
            "currentVersion": 1,
        }
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_1", "deadline": None})
    mock_assignment.return_value = asg_repo

    version_repo = MagicMock()
    version_repo.get_latest_revision_number = AsyncMock(return_value=1)
    # Latest snapshot in journal_versions is the initial draft snapshot (status="draft")
    version_repo.find_by_revision = AsyncMock(
        return_value={
            "journalId": "j_init_1",
            "revisionNumber": 1,
            "status": "draft",
            "trigger": "initial",
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Initial text"}}],
        }
    )
    version_repo.create_snapshot = AsyncMock(return_value={"id": "v1"})
    version_repo.mark_prior_submissions_past = AsyncMock()
    mock_version.return_value = version_repo
    mock_audit.return_value.log_event = AsyncMock()

    service = JournalService()
    res = await service.submit_journal("j_init_1", "student_1")

    # Verify journal updated to revision 1 (NOT 2)
    update_args = journal_repo.update_by_id.call_args[0][1]["$set"]
    assert update_args["currentVersion"] == 1
    assert update_args["status"] == "submitted"

    # Verify snapshot finalized revision 1
    call_kwargs = version_repo.create_snapshot.call_args[1]
    assert call_kwargs["revision_number"] == 1
    assert call_kwargs["status"] == "submitted"
    assert call_kwargs.get("allow_overwrite") is True


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_anti_flooding_resubmit_zero_changes_reactivates_revision(
    mock_audit, mock_assignment, mock_version, mock_journal
):
    """Anti-Flooding: Resubmitting after unsubmit with 0 changes reactivates existing revision without creating a new one."""
    blocks_data = [{"id": "b1", "type": "paragraph", "content": {"text": "Exact same content"}}]

    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_flood_1",
            "studentId": "student_1",
            "assignmentId": "asg_1",
            "status": "draft",
            "isRevoked": True,
            "title": "Revoked Lab",
            "blocks": blocks_data,
            "currentVersion": 1,
        }
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_1", "deadline": None})
    mock_assignment.return_value = asg_repo

    version_repo = MagicMock()
    version_repo.get_latest_revision_number = AsyncMock(return_value=1)
    # The revoked snapshot has the exact same content
    version_repo.find_by_revision = AsyncMock(
        return_value={
            "journalId": "j_flood_1",
            "revisionNumber": 1,
            "status": "revoked",
            "blocks": blocks_data,
        }
    )
    version_repo.update_version_status = AsyncMock(return_value=True)
    version_repo.mark_prior_submissions_past = AsyncMock()
    version_repo.create_snapshot = AsyncMock()
    mock_version.return_value = version_repo
    mock_audit.return_value.log_event = AsyncMock()

    service = JournalService()
    res = await service.submit_journal("j_flood_1", "student_1")

    # Verify journal updated to revision 1 (did NOT create revision 2)
    update_args = journal_repo.update_by_id.call_args[0][1]["$set"]
    assert update_args["currentVersion"] == 1
    assert update_args["status"] == "submitted"
    assert update_args["isRevoked"] is False

    # Verify update_version_status was used to reactivate, and create_snapshot was NOT called
    assert version_repo.update_version_status.called
    assert not version_repo.create_snapshot.called
    status_args = version_repo.update_version_status.call_args[0]
    assert status_args[1] == 1  # revision 1
    assert status_args[2] == "submitted"


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_resubmit_with_changes_creates_new_sequential_revision(
    mock_audit, mock_assignment, mock_version, mock_journal
):
    """Submitting after unsubmit with actual changes creates a new forward milestone revision."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_changed_1",
            "studentId": "student_1",
            "assignmentId": "asg_1",
            "status": "draft",
            "isRevoked": True,
            "title": "Revoked Lab with Changes",
            "blocks": [
                {"id": "b1", "type": "paragraph", "content": {"text": "Updated content after revocation"}},
                {"id": "b2", "type": "paragraph", "content": {"text": "New second block"}},
            ],
            "currentVersion": 1,
        }
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_1", "deadline": None})
    mock_assignment.return_value = asg_repo

    version_repo = MagicMock()
    version_repo.get_latest_revision_number = AsyncMock(return_value=1)
    # The revoked snapshot had the OLD single block
    version_repo.find_by_revision = AsyncMock(
        return_value={
            "journalId": "j_changed_1",
            "revisionNumber": 1,
            "status": "revoked",
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Old text"}}],
        }
    )
    version_repo.mark_prior_submissions_past = AsyncMock()
    version_repo.create_snapshot = AsyncMock(return_value={"id": "v2"})
    mock_version.return_value = version_repo
    mock_audit.return_value.log_event = AsyncMock()

    service = JournalService()
    res = await service.submit_journal("j_changed_1", "student_1")

    # Verify journal updated to revision 2 because changes were made
    update_args = journal_repo.update_by_id.call_args[0][1]["$set"]
    assert update_args["currentVersion"] == 2
    assert update_args["status"] == "submitted"

    # Verify create_snapshot was called for revision 2
    assert version_repo.create_snapshot.called
    call_kwargs = version_repo.create_snapshot.call_args[1]
    assert call_kwargs["revision_number"] == 2
    assert call_kwargs["status"] == "submitted"


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.ClassroomRepository")
async def test_request_changes_state_guard_rejects_unsubmitted_journal(
    mock_classroom, mock_assignment, mock_journal
):
    """Suite 6 Guard: Requesting changes on a draft or unsubmitted journal is rejected with HTTP 400."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "j_draft_req",
            "studentId": "student_1",
            "assignmentId": "asg_1",
            "status": "draft",
        }
    )
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_1", "classroomId": "c1"})
    mock_assignment.return_value = asg_repo

    classroom_repo = MagicMock()
    classroom_repo.find_by_id = AsyncMock(return_value={"id": "c1", "teacherId": "teacher_1"})
    mock_classroom.return_value = classroom_repo

    from app.schemas.comment import RequestChangesRequest
    from app.middleware.error_handler import AppException, ErrorCode

    service = JournalService()
    with pytest.raises(AppException) as excinfo:
        await service.request_changes(
            "j_draft_req",
            "teacher_1",
            RequestChangesRequest(remarks="Please fix formula 2"),
        )
    assert excinfo.value.code == ErrorCode.INVALID_WORKFLOW_STATE
    assert excinfo.value.status_code == 400

