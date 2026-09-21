"""Teacher Annotations, Block Comments, and Suggestions API router."""

from fastapi import APIRouter, Depends, Request, status

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.comment import CommentCreateRequest, CommentResponse
from app.schemas.response import ApiResponse, success_response
from app.services.comment_service import CommentService

router = APIRouter(prefix="/comments")


@router.post(
    "",
    response_model=ApiResponse[CommentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    payload: CommentCreateRequest,
    user: dict = Depends(get_active_user),
    comment_service: CommentService = Depends(),
):
    """Add a block-level comment, suggestion, or thread reply."""
    comment = await comment_service.add_comment(
        author_id=user["id"], author_role=user["role"], payload=payload
    )
    return success_response(comment)


@router.get("/journal/{journalId}", response_model=ApiResponse[list])
async def list_journal_comments(
    journalId: str,
    user: dict = Depends(get_active_user),
    comment_service: CommentService = Depends(),
):
    """Fetch all comment annotations for a specific journal document after authorization check."""
    comments = await comment_service.list_journal_comments(journalId, user["id"], user["role"])
    return success_response(comments)


@router.put("/{commentId}/resolve", response_model=ApiResponse[dict])
async def resolve_comment(
    commentId: str,
    user: dict = Depends(get_active_user),
    comment_service: CommentService = Depends(),
):
    """Resolve a comment thread after authorization check."""
    success = await comment_service.resolve_comment(commentId, user["id"], user["role"])
    return success_response({"success": success})



@router.post("/{commentId}/apply-suggestion", response_model=ApiResponse[dict])
async def apply_suggestion(
    commentId: str,
    user: dict = Depends(RoleChecker(["student"])),
    comment_service: CommentService = Depends(),
):
    """Student accepts teacher replacement suggestion, updating document content."""
    updated_journal = await comment_service.apply_teacher_suggestion(
        commentId, user["id"]
    )
    return success_response(updated_journal)
