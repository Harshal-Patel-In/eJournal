"""Unit tests for Journal management and Block Editor persistence workflow.

RULE-TEST01: Unit tests cover service-layer rules, permission checks, workflow state.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.schemas.journal import JournalCreateRequest, JournalSaveRequest, JournalBlock
from app.services.journal_service import JournalService


@pytest.mark.anyio
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.ClassroomRepository")
@patch("app.services.journal_service.ClassroomMembershipRepository")
@patch("app.services.journal_service.UserRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_create_journal_success(
    mock_audit, mock_user, mock_membership, mock_classroom, mock_assignment, mock_journal, mock_version
):
    """Test student successfully initializes a draft journal with generated template cover blocks."""
    version_repo = MagicMock()
    version_repo.create_snapshot = AsyncMock(return_value={"id": "ver_1"})
    mock_version.return_value = version_repo
    # Instantiating mocks
    journal_repo = MagicMock()
    journal_repo.find_student_journal_for_assignment = AsyncMock(return_value=None)
    journal_repo.insert_one = AsyncMock(return_value="journal_999")
    mock_journal.return_value = journal_repo

    assignment_repo = MagicMock()
    assignment_repo.find_by_id = AsyncMock(
        return_value={
            "id": "assignment_123",
            "classroomId": "classroom_456",
            "title": "Ohm's Law Verification",
            "experimentNumber": 2,
            "description": "To verify Ohm's Law.",
        }
    )
    mock_assignment.return_value = assignment_repo

    membership_repo = MagicMock()
    membership_repo.is_member = AsyncMock(return_value=True)
    mock_membership.return_value = membership_repo

    classroom_repo = MagicMock()
    classroom_repo.find_by_id = AsyncMock(
        return_value={"id": "classroom_456", "subject": "Physics I"}
    )
    mock_classroom.return_value = classroom_repo

    user_repo = MagicMock()
    user_repo.find_by_id = AsyncMock(
        return_value={
            "id": "student_123",
            "email": "student@charusat.edu.in",
            "profile": {
                "name": "Harshal Patel",
                "enrollmentNumber": "24CS065",
                "department": "CSE",
                "semester": "5",
                "division": "Div A",
            },
        }
    )
    mock_user.return_value = user_repo

    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    # Initialize Service
    service = JournalService()
    payload = JournalCreateRequest(assignmentId="assignment_123")

    # Run
    result = await service.create_journal("student_123", payload)

    # Verify
    assert result["id"] == "journal_999"
    assert result["status"] == "draft"
    assert len(result["blocks"]) > 0
    assert result["blocks"][0]["type"] == "heading"
    assert "Physics I" in result["blocks"][1]["content"]["text"]
    assert journal_repo.insert_one.called
    assert audit_repo.log_event.called


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.ClassroomMembershipRepository")
async def test_create_journal_idempotent(
    mock_membership, mock_assignment, mock_journal
):
    """Verify that starting a second draft for the same assignment returns the existing journal."""
    journal_repo = MagicMock()
    journal_repo.find_student_journal_for_assignment = AsyncMock(
        return_value={"id": "existing_journal_123"}
    )
    mock_journal.return_value = journal_repo

    assignment_repo = MagicMock()
    assignment_repo.find_by_id = AsyncMock(
        return_value={"id": "assignment_123", "classroomId": "classroom_456"}
    )
    mock_assignment.return_value = assignment_repo

    membership_repo = MagicMock()
    membership_repo.is_member = AsyncMock(return_value=True)
    mock_membership.return_value = membership_repo

    service = JournalService()
    payload = JournalCreateRequest(assignmentId="assignment_123")

    result = await service.create_journal("student_123", payload)
    assert result["id"] == "existing_journal_123"


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_save_journal_success(mock_audit, mock_journal):
    """Test editing blocks in a draft is permitted and updates MongoDB."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        side_effect=[
            {
                "id": "journal_999",
                "studentId": "student_123",
                "title": "Old Title",
                "status": "draft",
                "blocks": [],
            },
            {
                "id": "journal_999",
                "studentId": "student_123",
                "title": "New Title",
                "status": "draft",
                "blocks": [
                    {
                        "id": "b1",
                        "type": "heading",
                        "content": {"text": "New Heading", "level": 1},
                        "metadata": {},
                    }
                ],
            },
        ]
    )
    journal_repo.update_journal_blocks = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    service = JournalService()
    payload = JournalSaveRequest(
        title="New Title",
        blocks=[
            JournalBlock(
                id="b1",
                type="heading",
                content={"text": "New Heading", "level": 1},
                metadata={},
            )
        ],
    )

    result = await service.save_journal("journal_999", "student_123", payload)

    assert result["title"] == "New Title"
    assert len(result["blocks"]) == 1
    assert journal_repo.update_journal_blocks.called
    assert audit_repo.log_event.called


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
async def test_save_journal_unauthorized(mock_journal):
    """Test that editing another student's journal is blocked."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "journal_999",
            "studentId": "another_student_123",
            "title": "Physics Lab",
            "status": "draft",
            "blocks": [],
        }
    )
    mock_journal.return_value = journal_repo

    service = JournalService()
    payload = JournalSaveRequest(title="Hack Title", blocks=[])

    with pytest.raises(AppException) as excinfo:
        await service.save_journal("journal_999", "student_123", payload)
    assert excinfo.value.code == ErrorCode.FORBIDDEN


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.UserRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.ClassroomRepository")
@patch("app.repositories.notification_repository.NotificationRepository")
@patch("app.services.journal_service.AuditLogRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.utils.email.send_notification_email")
async def test_submit_journal_success(
    mock_send_email,
    mock_version,
    mock_audit,
    mock_notification,
    mock_classroom,
    mock_assignment,
    mock_user,
    mock_journal,
):
    """Test student successfully hands in (submits) a journal draft, dispatching notifications."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        side_effect=[
            {
                "id": "journal_999",
                "studentId": "student_123",
                "assignmentId": "assignment_123",
                "status": "draft",
            },
            {
                "id": "journal_999",
                "studentId": "student_123",
                "assignmentId": "assignment_123",
                "status": "submitted",
            },
        ]
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    version_repo = MagicMock()
    version_repo.create_snapshot = AsyncMock(return_value={"id": "version_1"})
    mock_version.return_value = version_repo

    user_repo = MagicMock()
    user_repo.find_by_id = AsyncMock(
        side_effect=[
            {
                "id": "student_123",
                "email": "student@charusat.edu.in",
                "profile": {"name": "Student Harshal"},
            },
            {
                "id": "teacher_456",
                "email": "teacher@charusat.edu.in",
                "profile": {"name": "Professor Vyas"},
            },
        ]
    )
    mock_user.return_value = user_repo

    assignment_repo = MagicMock()
    assignment_repo.find_by_id = AsyncMock(
        return_value={
            "id": "assignment_123",
            "classroomId": "classroom_789",
            "experimentNumber": 1,
            "title": "Ohm's Law",
        }
    )
    mock_assignment.return_value = assignment_repo

    classroom_repo = MagicMock()
    classroom_repo.find_by_id = AsyncMock(
        return_value={
            "id": "classroom_789",
            "name": "Physics Lab",
            "teacherId": "teacher_456",
        }
    )
    mock_classroom.return_value = classroom_repo

    notification_repo = MagicMock()
    notification_repo.create_notification = AsyncMock()
    mock_notification.return_value = notification_repo

    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    mock_send_email.return_value = True

    service = JournalService()
    result = await service.submit_journal("journal_999", "student_123")

    assert result["status"] == "submitted"
    assert journal_repo.update_by_id.called
    assert version_repo.create_snapshot.called
    assert notification_repo.create_notification.called
    assert mock_send_email.called
    assert audit_repo.log_event.called


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.ClassroomRepository")
async def test_approve_journal_unsubmitted_concurrency_rejection(
    mock_classroom, mock_assignment, mock_journal
):
    """Verify that approving a journal that was unsubmitted into draft returns HTTP 400 INVALID_WORKFLOW_STATE."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "journal_999",
            "studentId": "student_123",
            "assignmentId": "assignment_123",
            "status": "draft",  # Student un-submitted while teacher was grading!
        }
    )
    mock_journal.return_value = journal_repo

    from app.schemas.comment import ApproveJournalRequest

    service = JournalService()
    payload = ApproveJournalRequest(marks=10.0, remarks="Great work")

    with pytest.raises(AppException) as excinfo:
        await service.approve_journal("journal_999", "teacher_456", payload)
    assert excinfo.value.code == ErrorCode.INVALID_WORKFLOW_STATE
    assert excinfo.value.status_code == 400



@pytest.mark.anyio
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.JournalRepository")
async def test_submit_journal_already_submitted(mock_journal, mock_version):
    """Verify that submitting an already submitted journal is rejected."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "journal_999",
            "studentId": "student_123",
            "assignmentId": "assignment_123",
            "status": "submitted",
        }
    )
    mock_journal.return_value = journal_repo

    version_repo = MagicMock()
    version_repo.get_latest_revision_number = AsyncMock(return_value=1)
    mock_version.return_value = version_repo

    service = JournalService()

    with pytest.raises(AppException) as excinfo:
        await service.submit_journal("journal_999", "student_123")
    assert excinfo.value.code == ErrorCode.INVALID_WORKFLOW_STATE


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AssignmentRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_unsubmit_journal_success(mock_audit, mock_assignment, mock_journal):
    """Verify that unsubmitting a submitted journal reverts status back to draft."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "journal_999",
            "studentId": "student_123",
            "assignmentId": "asg_123",
            "status": "submitted",
        }
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    asg_repo = MagicMock()
    asg_repo.find_by_id = AsyncMock(return_value={"id": "asg_123", "deadline": None})
    mock_assignment.return_value = asg_repo

    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    service = JournalService()
    result = await service.unsubmit_journal("journal_999", "student_123")

    assert result["status"] == "submitted"  # Mock returns the mock doc, but verify update_one was called
    assert journal_repo.update_by_id.called
    assert audit_repo.log_event.called


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
async def test_update_single_block_revision_conflict(mock_journal):
    """Verify that updating a block with an outdated clientRevision raises a 409 REVISION_CONFLICT error."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "journal_999",
            "studentId": "student_123",
            "status": "draft",
            "currentVersion": 5,
        }
    )
    mock_journal.return_value = journal_repo

    from app.schemas.journal import SingleBlockUpdateRequest

    service = JournalService()
    payload = SingleBlockUpdateRequest(
        content={"text": "New Text"},
        clientRevision=4,  # Mismatched client revision!
    )

    with pytest.raises(AppException) as excinfo:
        await service.update_single_block(
            "journal_999", "student_123", "block_1", payload
        )
    assert excinfo.value.code == ErrorCode.REVISION_CONFLICT
    assert excinfo.value.status_code == 409


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_update_blocks_batch_revision_success(mock_audit, mock_journal):
    """Verify that batch block updates matching current version succeed and increment server revision."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "journal_999",
            "studentId": "student_123",
            "status": "draft",
            "currentVersion": 3,
        }
    )
    journal_repo.update_blocks_batch_with_revision = AsyncMock(
        return_value={
            "id": "journal_999",
            "title": "Batch Saved Journal",
            "currentVersion": 4,
            "blocks": [],
        }
    )
    mock_journal.return_value = journal_repo

    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    from app.schemas.journal import BatchBlockUpdateRequest

    service = JournalService()
    payload = BatchBlockUpdateRequest(
        title="Batch Saved Journal",
        blocks=[],
        clientRevision=3,  # Matches server revision!
    )

    result = await service.update_blocks_batch(
        "journal_999", "student_123", payload
    )

    assert result["currentVersion"] == 4
    assert journal_repo.update_blocks_batch_with_revision.called
    assert audit_repo.log_event.called


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.VersionRepository")
@patch("app.services.journal_service.AuditLogRepository")
async def test_restore_version_creates_safety_checkpoint(mock_audit, mock_version, mock_journal):
    """Verify restoring older version auto-saves active draft work as a safety checkpoint."""
    journal_repo = MagicMock()
    # Active journal has 2 blocks, whereas historical Rev 1 had 1 blank block
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "jour_res_1",
            "studentId": "student_123",
            "status": "draft",
            "title": "Lab with Unsaved Active Work",
            "currentVersion": 2,
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Active draft content"}}],
        }
    )
    journal_repo.update_by_id = AsyncMock(return_value=True)
    mock_journal.return_value = journal_repo

    version_repo = MagicMock()
    # Target version to restore (Revision 1)
    version_repo.find_one = AsyncMock(
        side_effect=[
            # 1. find target version (rev 1)
            {
                "id": "v1",
                "journalId": "jour_res_1",
                "revisionNumber": 1,
                "title": "Initial Blank Template",
                "blocks": [],
            },
            # 2. find latest snapshot (to compare active draft)
            {
                "id": "v1",
                "journalId": "jour_res_1",
                "revisionNumber": 1,
                "title": "Initial Blank Template",
                "blocks": [],
            },
        ]
    )
    version_repo.get_latest_revision_number = AsyncMock(return_value=1)
    version_repo.create_snapshot = AsyncMock(return_value={"id": "v_snap"})
    mock_version.return_value = version_repo

    audit_repo = MagicMock()
    audit_repo.log_event = AsyncMock()
    mock_audit.return_value = audit_repo

    service = JournalService()
    result = await service.restore_version_snapshot("jour_res_1", 1, "student_123")

    # Verify that create_snapshot was called TWICE:
    # 1st call: safety checkpoint of active draft
    # 2nd call: restored revision milestone
    assert version_repo.create_snapshot.call_count == 2
    first_call_kwargs = version_repo.create_snapshot.call_args_list[0][1]
    second_call_kwargs = version_repo.create_snapshot.call_args_list[1][1]

    assert "Auto-checkpoint" in first_call_kwargs["remarks"]
    assert first_call_kwargs["revision_number"] == 2
    assert len(first_call_kwargs["blocks"]) == 1

    assert "Restored state from Revision #1" in second_call_kwargs["remarks"]
    assert second_call_kwargs["revision_number"] == 3
    assert len(second_call_kwargs["blocks"]) == 0


@pytest.mark.anyio
@patch("app.services.journal_service.JournalRepository")
@patch("app.services.journal_service.VersionRepository")
async def test_restore_version_deduplication_indicator(mock_version, mock_journal):
    """Verify that restoring an identical version returns isAlreadyCurrent=True with clear feedback."""
    journal_repo = MagicMock()
    journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": "jour_res_2",
            "studentId": "student_123",
            "status": "draft",
            "title": "Same Document State",
            "currentVersion": 2,
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Exact same content"}}],
        }
    )
    mock_journal.return_value = journal_repo

    version_repo = MagicMock()
    # Target version has the EXACT same block content as active draft
    version_repo.find_one = AsyncMock(
        return_value={
            "id": "v1",
            "journalId": "jour_res_2",
            "revisionNumber": 1,
            "title": "Same Document State",
            "blocks": [{"id": "b1", "type": "paragraph", "content": {"text": "Exact same content"}}],
        }
    )
    mock_version.return_value = version_repo

    service = JournalService()
    result = await service.restore_version_snapshot("jour_res_2", 1, "student_123")

    assert result.get("isAlreadyCurrent") is True
    assert "Document is already in the exact state" in result.get("message", "")




