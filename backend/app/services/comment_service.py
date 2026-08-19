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

    async def add_annotation(
        self, journal_id: str, author_id: str, payload: CommentCreateRequest
    ) -> dict:
        """Add a block annotation supporting 6 types (Comment, Suggestion, Highlight, Warning, Approval, Question)."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        author = await self.user_repo.find_by_id(author_id)
        author_name = author.get("profile", {}).get("name", "Teacher") if author else "Teacher"

        # Determine review status badge mapping
        ann_type = payload.type.capitalize()
        if ann_type in ["Warning", "Suggestion"]:
            review_status = "Changes Requested"
        elif ann_type == "Approval":
            review_status = "Approved"
        else:
            review_status = "Reviewed"

        text_content = payload.content or payload.message or ""
        suggested_content = payload.suggestedContent
        if ann_type.lower() == "suggestion" and not suggested_content:
            suggested_content = {"text": text_content}

        comment_data = {
            "journalId": journal_id,
            "blockId": payload.blockId,
            "authorId": author_id,
            "authorName": author_name,
            "authorRole": "teacher",
            "type": ann_type,
            "content": text_content,
            "message": text_content,
            "suggestedContent": suggested_content,
            "reviewStatus": review_status,
            "status": "open",
            "parentCommentId": payload.parentCommentId,
            "createdAt": datetime.now(timezone.utc),
        }

        return await self.comment_repo.create_comment(comment_data)

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

        text_content = payload.message or payload.content or ""
        suggested_content = payload.suggestedContent
        if (payload.type or "").lower() == "suggestion" and not suggested_content:
            suggested_content = {"text": text_content}

        # 3. Create comment record
        comment_data = {
            "journalId": payload.journalId,
            "blockId": payload.blockId,
            "authorId": author_id,
            "authorName": author_name,
            "authorRole": author_role,
            "type": payload.type,
            "message": text_content,
            "content": text_content,
            "suggestedContent": suggested_content,
            "status": "open",
            "parentCommentId": payload.parentCommentId,
            "createdAt": datetime.now(timezone.utc),
        }
        created_comment = await self.comment_repo.create_comment(comment_data)

        # Notify the other party (teacher or student)
        try:
            from app.repositories.notification_repository import NotificationRepository
            from app.repositories.assignment_repository import AssignmentRepository
            from app.repositories.classroom_repository import ClassroomRepository
            from app.core.websocket_manager import websocket_manager

            notification_repo = NotificationRepository()
            recipient_id = None
            if author_role == "teacher":
                recipient_id = journal.get("studentId")
            else:
                asg_repo = AssignmentRepository()
                class_repo = ClassroomRepository()
                asg = await asg_repo.find_by_id(journal.get("assignmentId", ""))
                if asg:
                    classroom = await class_repo.find_by_id(asg.get("classroomId", ""))
                    if classroom:
                        recipient_id = classroom.get("teacherId")

            if recipient_id and recipient_id != author_id:
                type_label = payload.type.capitalize() if payload.type else "Comment"
                notif_title = f"New {type_label} on Journal"
                notif_msg = f"{author_name} posted a {type_label.lower()}: '{text_content[:60]}...'" if len(text_content) > 60 else f"{author_name} posted a {type_label.lower()}: '{text_content}'"
                notif_link = f"/editor/{payload.journalId}"
                notif_metadata = {
                    "entityType": "journals",
                    "entityId": payload.journalId,
                    "blockId": payload.blockId,
                    "commentId": created_comment.get("id"),
                    "actionUrl": notif_link,
                    "category": "comment",
                }
                notif_doc = await notification_repo.create_notification(
                    user_id=recipient_id,
                    title=notif_title,
                    message=notif_msg,
                    type_str="comment",
                    link=notif_link,
                    metadata=notif_metadata,
                )
                await websocket_manager.send_personal_notification(
                    recipient_id,
                    {
                        "type": "NEW_NOTIFICATION",
                        "notification": {
                            "id": notif_doc["id"],
                            "userId": recipient_id,
                            "title": notif_title,
                            "message": notif_msg,
                            "type": "comment",
                            "isRead": False,
                            "link": notif_link,
                            "metadata": notif_metadata,
                            "createdAt": notif_doc["createdAt"].isoformat(),
                        },
                    },
                )
        except Exception:
            pass

        return created_comment

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

        suggested_content = (
            comment.get("suggestedContent")
            or comment.get("content")
            or comment.get("message")
        )
        if (comment.get("type") or "").lower() != "suggestion" or not suggested_content:
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

        # Normalize suggested_content if it's a plain string
        if isinstance(suggested_content, str):
            suggested_content = {"text": suggested_content}

        # Apply suggestion content to specific block
        block_id = comment["blockId"]
        new_content = suggested_content
        current_rev = journal.get("currentVersion", 1)

        updated_journal = await self.journal_repo.update_single_block_with_revision(
            journal["id"], block_id, new_content, current_rev
        )

        # Mark comment resolved
        await self.comment_repo.resolve_comment(comment_id)

        return updated_journal or await self.journal_repo.find_by_id(journal["id"])
