"""Service handling Teacher Annotations, Comments, Threaded Replies, and Student Suggestion Application."""

from datetime import datetime, timezone
from fastapi import status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.comment_repository import CommentRepository
from app.repositories.journal_repository import JournalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.comment import CommentCreateRequest


class CommentService:
    """Comment and annotation management service."""

    def __init__(self):
        self.comment_repo = CommentRepository()
        self.journal_repo = JournalRepository()
        self.user_repo = UserRepository()

    async def add_comment(
        self, author_id: str, author_role: str, payload: CommentCreateRequest
    ) -> dict:
        """Add a block comment, suggestion, or thread reply."""
        # 1. Verify journal existence
        journal = await self.journal_repo.find_by_id(payload.journalId)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # 2. Fetch author profile
        author = await self.user_repo.find_by_id(author_id)
        author_name = (
            author.get("profile", {}).get("name", "User")
            if author
            else "User"
        )

        # 3. Create comment record
        comment_data = {
            "journalId": payload.journalId,
            "blockId": payload.blockId,
            "authorId": author_id,
            "authorName": author_name,
            "authorRole": author_role,
            "type": payload.type,
            "message": payload.message,
            "suggestedContent": payload.suggestedContent,
            "status": "open",
            "parentCommentId": payload.parentCommentId,
            "createdAt": datetime.now(timezone.utc),
        }

        return await self.comment_repo.create_comment(comment_data)

    async def list_journal_comments(self, journal_id: str) -> list[dict]:
        """Fetch all comments for a journal document."""
        return await self.comment_repo.find_journal_comments(journal_id)

    async def resolve_comment(self, comment_id: str) -> bool:
        """Mark a comment thread as resolved."""
        return await self.comment_repo.resolve_comment(comment_id)

    async def apply_teacher_suggestion(
        self, comment_id: str, student_id: str
    ) -> dict:
        """Student accepts teacher's block suggestion, applying replacement content to document."""
        comment = await self.comment_repo.find_by_id(comment_id)
        if not comment:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Comment not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if comment["type"] != "suggestion" or not comment.get("suggestedContent"):
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Comment is not an actionable suggestion",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        journal = await self.journal_repo.find_by_id(comment["journalId"])
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Associated journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if journal["studentId"] != student_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Only the student owner can accept suggestions",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Apply suggestion content to specific block
        block_id = comment["blockId"]
        new_content = comment["suggestedContent"]
        current_rev = journal.get("currentVersion", 1)

        updated_journal = await self.journal_repo.update_single_block_with_revision(
            journal["id"], block_id, new_content, current_rev
        )

        # Mark comment resolved
        await self.comment_repo.resolve_comment(comment_id)

        return updated_journal or await self.journal_repo.find_by_id(journal["id"])
