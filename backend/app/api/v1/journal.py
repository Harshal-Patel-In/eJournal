"""Visual Block-Based Document Editor API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC controls routes.
"""

from fastapi import APIRouter, Depends, Request, status

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.journal import (
    JournalCreateRequest,
    JournalSaveRequest,
    JournalResponse,
    SingleBlockUpdateRequest,
    BatchBlockUpdateRequest,
    BlockOrderUpdateRequest,
    BlockUpdateResponse,
    CheckpointCreateRequest,
)
from app.schemas.response import ApiResponse, success_response
from app.services.journal_service import JournalService

from app.schemas.comment import RequestChangesRequest, ApproveJournalRequest, CommentCreateRequest
from app.services.comment_service import CommentService

router = APIRouter(prefix="/journals")


@router.post(
    "",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_journal(
    payload: JournalCreateRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Initialize a new visual block draft journal for an assignment (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.create_journal(user["id"], payload, ip_address=ip_address)
    return success_response(journal)


@router.get("", response_model=ApiResponse[list])
async def list_my_journals(
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """List all journals belonging to the authenticated student."""
    journals = await journal_service.list_student_journals(user["id"])
    return success_response(journals)


@router.get("/classroom/{classroomId}/submissions", response_model=ApiResponse[list])
async def list_classroom_submissions(
    classroomId: str,
    user: dict = Depends(RoleChecker(["teacher"])),
    journal_service: JournalService = Depends(),
):
    """List all submitted or graded student journals for a classroom (Teacher dashboard)."""
    submissions = await journal_service.get_classroom_submissions(classroomId, user["id"])
    return success_response(submissions)


@router.get("/{journalId}", response_model=ApiResponse[JournalResponse])
async def get_journal(
    journalId: str,
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """Retrieve details and block contents of a journal (Student owner or Classroom teacher)."""
    journal = await journal_service.get_journal_by_id(journalId, user["id"], user["role"])
    return success_response(journal)


@router.put("/{journalId}", response_model=ApiResponse[JournalResponse])
async def save_journal(
    journalId: str,
    payload: JournalSaveRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Save/Sync the complete document blocks content for a draft journal (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.save_journal(
        journalId, user["id"], payload, ip_address=ip_address
    )
    return success_response(journal)


@router.patch("/{journalId}/blocks/{blockId}", response_model=ApiResponse[BlockUpdateResponse])
async def update_single_block(
    journalId: str,
    blockId: str,
    payload: SingleBlockUpdateRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Incremental update for a single block content with revision checking (Student only)."""
    ip_address = request.client.host if request.client else None
    result = await journal_service.update_single_block(
        journalId, user["id"], blockId, payload, ip_address=ip_address
    )
    return success_response(result)


@router.patch("/{journalId}/blocks", response_model=ApiResponse[JournalResponse])
async def update_blocks_batch(
    journalId: str,
    payload: BatchBlockUpdateRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Batch update all document blocks with optimistic concurrency checking (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.update_blocks_batch(
        journalId, user["id"], payload, ip_address=ip_address
    )
    return success_response(journal)


@router.put("/{journalId}/block-order", response_model=ApiResponse[JournalResponse])
async def update_block_order(
    journalId: str,
    payload: BlockOrderUpdateRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Update block sequence ordering with optimistic concurrency checking (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.update_block_order(
        journalId, user["id"], payload, ip_address=ip_address
    )
    return success_response(journal)


@router.post(
    "/{journalId}/submit",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_200_OK,
)
async def submit_journal(
    journalId: str,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Submit/Hand-in a visual journal for instructor review (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.submit_journal(
        journalId, user["id"], ip_address=ip_address
    )
    return success_response(journal)


@router.post(
    "/{journalId}/unsubmit",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_200_OK,
)
async def unsubmit_journal(
    journalId: str,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Undo submission/Unsubmit a visual journal back to draft (Student only)."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.unsubmit_journal(
        journalId, user["id"], ip_address=ip_address
    )
    return success_response(journal)


@router.post(
    "/{journalId}/request-changes",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_200_OK,
)
async def request_changes(
    journalId: str,
    payload: RequestChangesRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["teacher"])),
    journal_service: JournalService = Depends(),
):
    """Teacher requests corrections from student, reopening journal to draft state."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.request_changes(
        journalId, user["id"], payload, ip_address=ip_address
    )
    return success_response(journal)


@router.post(
    "/{journalId}/approve",
    response_model=ApiResponse[JournalResponse],
    status_code=status.HTTP_200_OK,
)
async def approve_journal(
    journalId: str,
    payload: ApproveJournalRequest,
    request: Request,
    user: dict = Depends(RoleChecker(["teacher"])),
    journal_service: JournalService = Depends(),
):
    """Teacher approves student journal submission and assigns marks."""
    ip_address = request.client.host if request.client else None
    journal = await journal_service.approve_journal(
        journalId, user["id"], payload, ip_address=ip_address
    )
    return success_response(journal)

@router.post("/{journalId}/annotations", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED)
async def create_annotation(
    journalId: str,
    payload: CommentCreateRequest,
    user: dict = Depends(RoleChecker(["teacher"])),
    comment_service: CommentService = Depends(),
):
    """Create a teacher block annotation (Comment, Suggestion, Highlight, Warning, Approval, Question)."""
    annotation = await comment_service.add_annotation(journalId, user["id"], payload)
    return success_response(annotation)


@router.get("/{journalId}/annotations", response_model=ApiResponse[list])
async def list_annotations(
    journalId: str,
    user: dict = Depends(get_active_user),
    comment_service: CommentService = Depends(),
):
    """List all teacher review annotations for a journal document."""
    comments = await comment_service.list_journal_comments(journalId, user["id"], user["role"])
    return success_response(comments)



@router.get("/{journalId}/versions", response_model=ApiResponse[list])
async def list_journal_versions(
    journalId: str,
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """Retrieve historical revision snapshots of a journal document."""
    versions = await journal_service.get_journal_versions(journalId, user["id"], user["role"])
    return success_response(versions)


@router.get("/{journalId}/versions/{revisionNumber}", response_model=ApiResponse[dict])
async def get_journal_version(
    journalId: str,
    revisionNumber: int,
    user: dict = Depends(get_active_user),
    journal_service: JournalService = Depends(),
):
    """Retrieve and reconstruct a specific historical revision snapshot."""
    version = await journal_service.get_journal_version_by_revision(
        journalId, revisionNumber, user["id"], user["role"]
    )
    return success_response(version)


@router.post("/{journalId}/versions/{revisionNumber}/restore", response_model=ApiResponse[JournalResponse])
async def restore_journal_version(
    journalId: str,
    revisionNumber: int,
    request: Request,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Restore a historical version snapshot to be the active journal state (Student only)."""
    ip_address = request.client.host if request.client else None
    restored = await journal_service.restore_version_snapshot(
        journalId, revisionNumber, user["id"], ip_address=ip_address
    )
    return success_response(restored)


@router.post("/{journalId}/checkpoint", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED)
async def create_journal_checkpoint(
    journalId: str,
    request: Request,
    payload: CheckpointCreateRequest | None = None,
    remarks: str | None = None,
    user: dict = Depends(RoleChecker(["student"])),
    journal_service: JournalService = Depends(),
):
    """Manually create an immutable revision snapshot milestone for current journal state (Student only)."""
    ip_address = request.client.host if request.client else None
    note = (payload.remarks if payload and payload.remarks else remarks) or "Manual checkpoint snapshot"
    snapshot = await journal_service.create_checkpoint(
        journalId, user["id"], remarks=note, ip_address=ip_address
    )
    return success_response(snapshot)



