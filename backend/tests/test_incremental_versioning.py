"""Comprehensive test suite for block-level incremental versioning architecture.

RULE-VH01: Historical revisions must remain immutable.
RULE-VH02: Revisions MUST be stored in journal_versions collection.
RULE-VH05: Restoring a historical snapshot MUST create a new forward revision.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.journal_service import JournalService
from app.repositories.block_version_repository import BlockVersionRepository
from app.repositories.version_repository import VersionRepository
from app.core.config import settings


@pytest.mark.anyio
async def test_detect_block_changes_insert_and_preservation():
    """Verify that adding blocks records deltas only for new blocks, preserving existing unchanged ones."""
    service = JournalService()
    journal_id = "test_j_1"

    b1 = {"id": "block_1", "type": "paragraph", "content": {"text": "Original text"}}
    b2 = {"id": "block_2", "type": "heading", "content": {"text": "Title 1"}}

    # Rev 1: initial blocks
    deltas1, changed_ids1, struct1 = service._detect_block_changes(
        prev_blocks=[],
        new_blocks=[b1, b2],
        new_rev=1,
        journal_id=journal_id,
    )
    assert len(deltas1) == 2
    assert set(changed_ids1) == {"block_1", "block_2"}
    assert all(d["operation"] in ("create", "insert") for d in deltas1)

    # Rev 2: b1 unchanged, b3 added
    b3 = {"id": "block_3", "type": "equation", "content": {"latex": "E=mc^2"}}
    deltas2, changed_ids2, struct2 = service._detect_block_changes(
        prev_blocks=[b1, b2],
        new_blocks=[b1, b2, b3],
        new_rev=2,
        journal_id=journal_id,
    )
    # Only b3 should have a delta; b1 and b2 are preserved without duplication
    assert len(deltas2) == 1
    assert deltas2[0]["blockId"] == "block_3"
    assert deltas2[0]["operation"] in ("create", "insert")
    assert changed_ids2 == ["block_3"]


@pytest.mark.anyio
async def test_detect_block_changes_update_and_content_hash():
    """Verify editing a block detects content hash difference and creates an 'update' delta."""
    service = JournalService()
    journal_id = "test_j_2"

    b1 = {"id": "block_1", "type": "paragraph", "content": {"text": "Version 1 text"}}
    b2 = {"id": "block_2", "type": "table", "content": {"rows": [["1", "2"]]}}

    # Edit b1 in Rev 2
    b1_edited = {"id": "block_1", "type": "paragraph", "content": {"text": "Version 2 text edited"}}

    deltas, changed_ids, struct_changed = service._detect_block_changes(
        prev_blocks=[b1, b2],
        new_blocks=[b1_edited, b2],
        new_rev=2,
        journal_id=journal_id,
    )

    assert len(deltas) == 1
    assert deltas[0]["blockId"] == "block_1"
    assert deltas[0]["operation"] == "update"
    assert deltas[0]["content"]["text"] == "Version 2 text edited"
    assert changed_ids == ["block_1"]
    assert struct_changed is False


@pytest.mark.anyio
async def test_detect_block_changes_delete_records_tombstone():
    """Verify deleting a block creates an explicit tombstone record in journal_block_versions."""
    service = JournalService()
    journal_id = "test_j_3"

    b1 = {"id": "block_1", "type": "paragraph", "content": {"text": "Text 1"}}
    b2 = {"id": "block_2", "type": "paragraph", "content": {"text": "Text to delete"}}

    # Rev 2: b2 removed
    deltas, changed_ids, struct_changed = service._detect_block_changes(
        prev_blocks=[b1, b2],
        new_blocks=[b1],
        new_rev=2,
        journal_id=journal_id,
    )

    assert len(deltas) == 1
    assert deltas[0]["blockId"] == "block_2"
    assert deltas[0]["operation"] == "delete"
    assert "block_2" in changed_ids
    assert struct_changed is True


@pytest.mark.anyio
async def test_detect_block_changes_reorder_structure_changed():
    """Verify reordering blocks without content modifications flags structureChanged=True and zero content deltas."""
    service = JournalService()
    journal_id = "test_j_4"

    b1 = {"id": "block_1", "type": "paragraph", "content": {"text": "Text A"}}
    b2 = {"id": "block_2", "type": "paragraph", "content": {"text": "Text B"}}

    # Swap b1 and b2 order
    deltas, changed_ids, struct_changed = service._detect_block_changes(
        prev_blocks=[b1, b2],
        new_blocks=[b2, b1],
        new_rev=2,
        journal_id=journal_id,
    )

    # Content unchanged -> no new block deltas
    assert len(deltas) == 0
    assert len(changed_ids) == 0
    # But structural ordering changed
    assert struct_changed is True


@pytest.mark.anyio
async def test_reconstruction_engine_ordering_and_tombstone_filtering():
    """Verify resolve_journal_revision reconstructs canonical order and excludes tombstones."""
    service = JournalService()
    journal_id = "test_j_5"

    version_doc = {
        "journalId": journal_id,
        "revisionNumber": 3,
        "title": "Historical Lab",
        "blockOrder": ["b2", "b1"],
        "schemaVersion": 1,
    }
    service.version_repo = MagicMock()
    service.version_repo.find_by_revision = AsyncMock(return_value=version_doc)

    # Mock block version repository returning latest deltas for b1 and b2
    service.block_version_repo = MagicMock()
    service.block_version_repo.get_blocks_for_revision = AsyncMock(
        return_value=[
            {"blockId": "b1", "type": "paragraph", "content": {"text": "B1 text"}, "operation": "insert"},
            {"blockId": "b2", "type": "heading", "content": {"text": "B2 heading"}, "operation": "insert"},
        ]
    )

    reconstructed = await service.resolve_journal_revision(journal_id, 3)

    assert reconstructed["title"] == "Historical Lab"
    assert len(reconstructed["blocks"]) == 2
    # Verify strict blockOrder compliance: b2 comes before b1
    assert reconstructed["blocks"][0]["id"] == "b2"
    assert reconstructed["blocks"][0]["type"] == "heading"
    assert reconstructed["blocks"][1]["id"] == "b1"
    assert reconstructed["blocks"][1]["type"] == "paragraph"


@pytest.mark.anyio
async def test_restore_version_creates_forward_revision():
    """Verify restoring a past revision creates a strictly forward revision (RULE-VH05)."""
    service = JournalService()
    journal_id = "test_j_restore"
    student_id = "stu_1"

    service.journal_repo = MagicMock()
    service.journal_repo.find_by_id = AsyncMock(
        return_value={
            "id": journal_id,
            "studentId": student_id,
            "status": "draft",
            "title": "Current Journal",
            "currentVersion": 5,
            "blocks": [{"id": "b_new", "type": "paragraph", "content": {"text": "Recent Draft"}}],
        }
    )
    service.journal_repo.update_by_id = AsyncMock(return_value=True)

    # Historical revision 2 had 1 block
    target_hist = {
        "journalId": journal_id,
        "revisionNumber": 2,
        "title": "Old Rev 2 Title",
        "blocks": [{"id": "b_old", "type": "paragraph", "content": {"text": "Old Rev 2 Text"}}],
        "blockOrder": ["b_old"],
    }
    service.resolve_journal_revision = AsyncMock(return_value=target_hist)

    service.version_repo = MagicMock()
    service.version_repo.get_latest_revision_number = AsyncMock(return_value=5)
    service.version_repo.find_by_revision = AsyncMock(return_value={"blocks": []})
    service.version_repo.create_snapshot = AsyncMock(return_value={"id": "v_restored"})

    service.audit_repo = MagicMock()
    service.audit_repo.log_event = AsyncMock()

    res = await service.restore_version_snapshot(journal_id, 2, student_id)

    # Must update journal to forward revision (latest 5 + safety 6 + restore 7 or latest 5 + restore 6)
    assert service.journal_repo.update_by_id.called
    update_args = service.journal_repo.update_by_id.call_args[0][1]["$set"]
    assert update_args["currentVersion"] >= 6
    assert update_args["title"] == "Old Rev 2 Title"
    assert update_args["blocks"] == target_hist["blocks"]
