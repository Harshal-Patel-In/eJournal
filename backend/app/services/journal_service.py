"""Journal management and document editing business logic service.

RULE-BE04: All business logic MUST live inside service classes.
"""

import hashlib
import json
from datetime import datetime, timezone
from fastapi import status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.assignment_repository import AssignmentRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.classroom_membership_repository import ClassroomMembershipRepository
from app.repositories.classroom_repository import ClassroomRepository
from app.repositories.comment_repository import CommentRepository
from app.repositories.journal_repository import JournalRepository
from app.repositories.user_repository import UserRepository
from app.repositories.version_repository import VersionRepository
from app.schemas.journal import (
    JournalCreateRequest,
    JournalSaveRequest,
    SingleBlockUpdateRequest,
    BatchBlockUpdateRequest,
    BlockOrderUpdateRequest,
)
from app.schemas.comment import RequestChangesRequest, ApproveJournalRequest


class JournalService:
    """Journal management workflows service."""

    def __init__(self):
        self.journal_repo = JournalRepository()
        self.assignment_repo = AssignmentRepository()
        self.classroom_repo = ClassroomRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.user_repo = UserRepository()
        self.audit_repo = AuditLogRepository()
        self.version_repo = VersionRepository()
        self.comment_repo = CommentRepository()

    async def _validate_journal_ownership_and_state(self, journal_id: str, student_id: str) -> dict:
        """Helper to validate existence, student ownership, and draft/editable state."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if journal["studentId"] != student_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You do not own this journal",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if journal["status"] not in ["draft", "changes_requested"]:
            raise AppException(
                code=ErrorCode.INVALID_WORKFLOW_STATE,
                message="Cannot edit journal after submission or approval",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return journal

    async def create_journal(
        self, student_id: str, request: JournalCreateRequest, ip_address: str | None = None
    ) -> dict:
        """Initialize a new visual block draft journal for an assignment (Student only)."""
        assignment = await self.assignment_repo.find_by_id(request.assignmentId)
        if not assignment:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Assignment not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        classroom_id = assignment["classroomId"]
        enrolled = await self.membership_repo.is_member(classroom_id, student_id)
        if not enrolled:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not enrolled in the classroom for this assignment",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        existing = await self.journal_repo.find_student_journal_for_assignment(
            student_id, request.assignmentId
        )
        if existing:
            return existing

        student = await self.user_repo.find_by_id(student_id)
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        
        student_profile = student.get("profile", {}) if student else {}
        student_name = student_profile.get("name") or (student["email"] if student else "Student")
        enrollment = student_profile.get("enrollmentNumber") or "N/A"
        department = student_profile.get("department") or "N/A"
        semester = student_profile.get("semester") or "N/A"
        division = student_profile.get("division") or "N/A"

        subject = classroom.get("subject") or "N/A" if classroom else "N/A"
        experiment_num = assignment.get("experimentNumber") or 1
        aim = assignment.get("description") or "To perform the practical as per instructions."

        blocks = [
            {
                "id": "cover-title-block",
                "type": "heading",
                "content": {
                    "text": f"Experiment {experiment_num}: {assignment['title']}",
                    "level": 1,
                },
                "metadata": {"createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            },
            {
                "id": "cover-metadata-block",
                "type": "paragraph",
                "content": {
                    "text": (
                        f"Student Name: {student_name}\n"
                        f"Enrollment Number: {enrollment}\n"
                        f"Department / Semester / Division: {department} / Sem {semester} / Div {division}\n"
                        f"Subject: {subject}\n"
                        f"Aim of Experiment: {aim}"
                    )
                },
                "metadata": {"createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            },
            {
                "id": "aim-header-block",
                "type": "heading",
                "content": {"text": "Aim & Objective", "level": 2},
                "metadata": {"createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            },
            {
                "id": "aim-content-block",
                "type": "paragraph",
                "content": {"text": aim},
                "metadata": {"createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            },
            {
                "id": "procedure-header-block",
                "type": "heading",
                "content": {"text": "Procedure & Code Implementation", "level": 2},
                "metadata": {"createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            },
            {
                "id": "procedure-content-block",
                "type": "paragraph",
                "content": {"text": "Insert your procedure description, observations, code files, or diagrams below..."},
                "metadata": {"createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            },
        ]

        journal_doc = {
            "assignmentId": request.assignmentId,
            "studentId": student_id,
            "title": f"Experiment {experiment_num}: {assignment['title']}",
            "status": "draft",
            "currentVersion": 1,
            "blocks": blocks,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }

        journal_id = await self.journal_repo.insert_one(journal_doc)

        await self.version_repo.create_snapshot(
            journal_id=journal_id,
            author_id=student_id,
            status="draft",
            blocks=blocks,
            title=journal_doc["title"],
            revision_number=1,
            remarks="Initial draft created",
        )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_CREATED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return {
            "id": journal_id,
            "assignmentId": request.assignmentId,
            "studentId": student_id,
            "title": journal_doc["title"],
            "status": journal_doc["status"],
            "currentVersion": journal_doc["currentVersion"],
            "blocks": blocks,
            "createdAt": journal_doc["createdAt"],
            "updatedAt": journal_doc["updatedAt"],
        }

    async def get_journal_by_id(
        self, journal_id: str, user_id: str, user_role: str
    ) -> dict:
        """Fetch a specific journal state, verifying RBAC permissions."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if user_role == "student":
            if journal["studentId"] != user_id:
                raise AppException(
                    code=ErrorCode.FORBIDDEN,
                    message="You are not authorized to view this journal",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        elif user_role == "teacher":
            assignment = await self.assignment_repo.find_by_id(journal["assignmentId"])
            if not assignment:
                raise AppException(
                    code=ErrorCode.NOT_FOUND,
                    message="Associated assignment not found",
                    status_code=status.HTTP_404_NOT_FOUND,
                )
            classroom = await self.classroom_repo.find_by_id(assignment["classroomId"])
            if not classroom or classroom["teacherId"] != user_id:
                raise AppException(
                    code=ErrorCode.FORBIDDEN,
                    message="You are not authorized to view journals from this classroom",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

        counts = await self.comment_repo.get_annotation_counts(journal_id)
        journal["annotationCounts"] = counts
        return journal

    async def list_student_journals(self, student_id: str) -> list[dict]:
        """List all visual journals owned by the student."""
        journals = await self.journal_repo.find_many({"studentId": student_id})
        for j in journals:
            j["annotationCounts"] = await self.comment_repo.get_annotation_counts(j["id"])
        return journals

    async def save_journal(
        self, journal_id: str, student_id: str, request: JournalSaveRequest, ip_address: str | None = None
    ) -> dict:
        """Update/Sync the block array of a journal in progress (Student only)."""
        journal = await self._validate_journal_ownership_and_state(journal_id, student_id)

        blocks_list = [block.model_dump() for block in request.blocks]
        success = await self.journal_repo.update_journal_blocks(
            journal_id, request.title, blocks_list
        )
        if not success:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to save document updates",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_SAVED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)

    async def update_single_block(
        self,
        journal_id: str,
        student_id: str,
        block_id: str,
        request: SingleBlockUpdateRequest,
        ip_address: str | None = None,
    ) -> dict:
        """Incremental update for a single block with optimistic concurrency control."""
        journal = await self._validate_journal_ownership_and_state(journal_id, student_id)

        current_ver = journal.get("currentVersion", 1)
        if request.clientRevision != current_ver:
            raise AppException(
                code=ErrorCode.REVISION_CONFLICT,
                message=f"Document version conflict (server is revision {current_ver}, client sent {request.clientRevision}). Reload latest version or resolve conflict.",
                status_code=status.HTTP_409_CONFLICT,
            )

        updated_journal = await self.journal_repo.update_single_block_with_revision(
            journal_id, block_id, request.content, request.clientRevision
        )
        if not updated_journal:
            raise AppException(
                code=ErrorCode.REVISION_CONFLICT,
                message="Document revision mismatch or block not found",
                status_code=status.HTTP_409_CONFLICT,
            )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="BLOCK_UPDATED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return {
            "journalId": journal_id,
            "serverRevision": updated_journal.get("currentVersion", current_ver + 1),
            "savedAt": updated_journal.get("updatedAt"),
        }

    async def update_blocks_batch(
        self,
        journal_id: str,
        student_id: str,
        request: BatchBlockUpdateRequest,
        ip_address: str | None = None,
    ) -> dict:
        """Batch update for document blocks with optimistic concurrency control."""
        journal = await self._validate_journal_ownership_and_state(journal_id, student_id)

        current_ver = journal.get("currentVersion", 1)
        if request.clientRevision != current_ver:
            raise AppException(
                code=ErrorCode.REVISION_CONFLICT,
                message=f"Document version conflict (server is revision {current_ver}, client sent {request.clientRevision}). Reload latest version or resolve conflict.",
                status_code=status.HTTP_409_CONFLICT,
            )

        blocks_list = [block.model_dump() for block in request.blocks]
        updated_journal = await self.journal_repo.update_blocks_batch_with_revision(
            journal_id, blocks_list, request.clientRevision, request.title
        )
        if not updated_journal:
            raise AppException(
                code=ErrorCode.REVISION_CONFLICT,
                message="Document revision mismatch during batch save",
                status_code=status.HTTP_409_CONFLICT,
            )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_SAVED_BATCH",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return updated_journal

    async def update_block_order(
        self,
        journal_id: str,
        student_id: str,
        request: BlockOrderUpdateRequest,
        ip_address: str | None = None,
    ) -> dict:
        """Update block sequence order with optimistic concurrency control."""
        journal = await self._validate_journal_ownership_and_state(journal_id, student_id)

        current_ver = journal.get("currentVersion", 1)
        if request.clientRevision != current_ver:
            raise AppException(
                code=ErrorCode.REVISION_CONFLICT,
                message=f"Document version conflict (server is revision {current_ver}, client sent {request.clientRevision}). Reload latest version or resolve conflict.",
                status_code=status.HTTP_409_CONFLICT,
            )

        updated_journal = await self.journal_repo.update_block_order_with_revision(
            journal_id, request.blockOrder, request.clientRevision
        )
        if not updated_journal:
            raise AppException(
                code=ErrorCode.REVISION_CONFLICT,
                message="Document revision mismatch during reorder",
                status_code=status.HTTP_409_CONFLICT,
            )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="BLOCKS_REORDERED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return updated_journal

    async def submit_journal(
        self, journal_id: str, student_id: str, ip_address: str | None = None
    ) -> dict:
        """Submit a journal draft for review, locking editing, creating an immutable snapshot, and notifying teacher."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if journal["studentId"] != student_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You do not own this journal",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if journal["status"] not in ["draft", "changes_requested"] and not journal.get("isRevoked", False):
            # Self-healing check: if status is submitted/late_submitted but no snapshot exists yet, allow retrying submission
            latest_rev = await self.version_repo.get_latest_revision_number(journal_id)
            if latest_rev > 0:
                raise AppException(
                    code=ErrorCode.INVALID_WORKFLOW_STATE,
                    message=f"Cannot submit journal in '{journal['status']}' status",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        now = datetime.now(timezone.utc)
        
        # Check deadline status
        assignment = await self.assignment_repo.find_by_id(journal["assignmentId"])
        is_late = False
        delay_seconds = 0
        target_status = "submitted"

        if assignment and assignment.get("deadline"):
            try:
                deadline_raw = assignment["deadline"]
                if isinstance(deadline_raw, datetime):
                    deadline_dt = deadline_raw if deadline_raw.tzinfo is not None else deadline_raw.replace(tzinfo=timezone.utc)
                elif isinstance(deadline_raw, str):
                    deadline_dt = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
                    if deadline_dt.tzinfo is None:
                        deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
                else:
                    deadline_dt = None

                if deadline_dt and now > deadline_dt:
                    is_late = True
                    target_status = "late_submitted"
                    delay_seconds = int((now - deadline_dt).total_seconds())
            except Exception:
                pass

        success = await self.journal_repo.update_by_id(
            journal_id,
            {
                "$set": {
                    "status": target_status,
                    "submittedAt": now,
                    "isLate": is_late,
                    "delaySeconds": delay_seconds,
                    "isRevoked": False,
                    "updatedAt": now,
                }
            }
        )
        if not success:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to submit journal",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Create Immutable Submission Snapshot in journal_versions (RULE-VER01)
        current_rev = journal.get("currentVersion", 1)
        await self.version_repo.create_snapshot(
            journal_id=journal_id,
            author_id=student_id,
            status=target_status,
            blocks=journal.get("blocks", []),
            title=journal.get("title", "Untitled Journal"),
            revision_number=current_rev,
        )

        # Notify the teacher (in-app notification and email alert)
        from app.repositories.notification_repository import NotificationRepository
        from app.utils.email import send_notification_email

        notification_repo = NotificationRepository()
        student = await self.user_repo.find_by_id(student_id)
        student_name = student.get("profile", {}).get("name", "A Student") if student else "A Student"

        if assignment:
            classroom = await self.classroom_repo.find_by_id(assignment["classroomId"])
            if classroom:
                teacher_id = classroom["teacherId"]
                classroom_name = classroom["name"]
                exp_num = assignment.get("experimentNumber", 1)

                late_str = " (LATE SUBMISSION)" if is_late else ""
                msg = f"{student_name} has handed in the journal for Experiment #{exp_num} in {classroom_name}{late_str}."
                link = f"/classrooms/{classroom['id']}/grades?assignment={assignment['id']}"
                metadata = {
                    "entityType": "journals",
                    "entityId": journal_id,
                    "classroomId": classroom["id"],
                    "assignmentId": assignment["id"],
                    "experimentNumber": exp_num,
                    "actionUrl": link,
                    "category": "submission",
                }
                notif_doc = await notification_repo.create_notification(
                    user_id=teacher_id,
                    title="Journal Submission",
                    message=msg,
                    type_str="submission",
                    link=link,
                    metadata=metadata,
                )

                try:
                    from app.core.websocket_manager import websocket_manager
                    await websocket_manager.send_personal_notification(
                        teacher_id,
                        {
                            "type": "NEW_NOTIFICATION",
                            "notification": {
                                "id": notif_doc["id"],
                                "userId": teacher_id,
                                "title": "Journal Submission",
                                "message": msg,
                                "type": "submission",
                                "isRead": False,
                                "link": link,
                                "metadata": metadata,
                                "createdAt": notif_doc["createdAt"].isoformat(),
                            },
                        },
                    )
                except Exception as ws_err:
                    pass

                teacher = await self.user_repo.find_by_id(teacher_id)
                if teacher and teacher.get("email"):
                    email_subject = f"Journal Submitted: {student_name} (Exp #{exp_num}){late_str}"
                    email_body = f"""
                    <html>
                        <body style="font-family: sans-serif; padding: 20px; color: #171717;">
                            <h2 style="color: #212529;">Journal Submission Handed In</h2>
                            <p>Hello <strong>{teacher.get('profile', {}).get('name', 'Teacher')}</strong>,</p>
                            <p>A student has submitted their practical lab journal for review:</p>
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6;">
                                <p><strong>Student Name:</strong> {student_name}</p>
                                <p><strong>Classroom:</strong> {classroom_name}</p>
                                <p><strong>Experiment:</strong> #{exp_num} ({assignment['title']})</p>
                                <p><strong>Status:</strong> {'LATE SUBMISSION' if is_late else 'ON TIME'}</p>
                            </div>
                            <p>Please log in to your dashboard to grade this submission.</p>
                        </body>
                    </html>
                    """
                    await send_notification_email(teacher["email"], email_subject, email_body)

        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_SUBMITTED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)

    async def unsubmit_journal(
        self, journal_id: str, student_id: str, ip_address: str | None = None
    ) -> dict:
        """Undo a student's journal submission, unlocking it back to draft state if before deadline."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        if journal["studentId"] != student_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You do not own this journal",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        if journal["status"] not in ["submitted", "late_submitted"]:
            raise AppException(
                code=ErrorCode.INVALID_WORKFLOW_STATE,
                message="Only submitted journals can be unsubmitted",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Check deadline for unsubmit permission
        assignment = await self.assignment_repo.find_by_id(journal["assignmentId"])
        if assignment and assignment.get("deadline"):
            try:
                deadline_raw = assignment["deadline"]
                if isinstance(deadline_raw, datetime):
                    deadline_dt = deadline_raw if deadline_raw.tzinfo is not None else deadline_raw.replace(tzinfo=timezone.utc)
                elif isinstance(deadline_raw, str):
                    deadline_dt = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
                    if deadline_dt.tzinfo is None:
                        deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
                else:
                    deadline_dt = None

                if deadline_dt and datetime.now(timezone.utc) > deadline_dt:
                    raise AppException(
                        code=ErrorCode.INVALID_WORKFLOW_STATE,
                        message="Deadline has expired. Submissions cannot be unsubmitted after the deadline.",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
            except AppException:
                raise
            except Exception:
                pass

        now = datetime.now(timezone.utc)
        success = await self.journal_repo.update_by_id(
            journal_id,
            {
                "$set": {
                    "status": "draft",
                    "isRevoked": True,
                    "updatedAt": now,
                },
                "$inc": {"unsubmitCount": 1},
            },
        )
        if not success:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to revert submission state",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_UNSUBMITTED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)

    async def request_changes(
        self,
        journal_id: str,
        teacher_id: str,
        payload: RequestChangesRequest,
        ip_address: str | None = None,
    ) -> dict:
        """Teacher requests corrections from student, reopening document to draft state."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        assignment = await self.assignment_repo.find_by_id(journal["assignmentId"])
        if not assignment:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Assignment not found")
        classroom = await self.classroom_repo.find_by_id(assignment["classroomId"])
        if not classroom or classroom["teacherId"] != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to review this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        now = datetime.now(timezone.utc)
        latest_rev = await self.version_repo.get_latest_revision_number(journal_id)
        new_revision = max(latest_rev + 1, journal.get("currentVersion", 1) + 1)

        await self.journal_repo.update_by_id(
            journal_id,
            {
                "$set": {
                    "status": "changes_requested",
                    "teacherRemarks": payload.remarks,
                    "currentVersion": new_revision,
                    "updatedAt": now,
                }
            },
        )

        await self.version_repo.create_snapshot(
            journal_id=journal_id,
            author_id=teacher_id,
            status="changes_requested",
            blocks=journal.get("blocks", []),
            title=journal.get("title", "Journal"),
            revision_number=new_revision,
            remarks=payload.remarks,
        )

        from app.repositories.notification_repository import NotificationRepository
        notification_repo = NotificationRepository()
        exp_num = assignment.get("experimentNumber", 1)
        changes_msg = f"Your teacher requested changes on Experiment #{exp_num}: '{payload.remarks}'"
        changes_link = f"/editor/{journal_id}"
        changes_metadata = {
            "entityType": "journals",
            "entityId": journal_id,
            "classroomId": assignment["classroomId"],
            "assignmentId": assignment["id"],
            "experimentNumber": exp_num,
            "actionUrl": changes_link,
            "category": "review",
        }
        notif_doc = await notification_repo.create_notification(
            user_id=journal["studentId"],
            title="Changes Requested",
            message=changes_msg,
            type_str="review",
            link=changes_link,
            metadata=changes_metadata,
        )

        try:
            from app.core.websocket_manager import websocket_manager
            await websocket_manager.send_personal_notification(
                journal["studentId"],
                {
                    "type": "NEW_NOTIFICATION",
                    "notification": {
                        "id": notif_doc["id"],
                        "userId": journal["studentId"],
                        "title": "Changes Requested",
                        "message": changes_msg,
                        "type": "review",
                        "isRead": False,
                        "link": changes_link,
                        "metadata": changes_metadata,
                        "createdAt": notif_doc["createdAt"].isoformat(),
                    },
                },
            )
        except Exception:
            pass

        await self.audit_repo.log_event(
            user_id=teacher_id,
            action="CHANGES_REQUESTED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)

    async def approve_journal(
        self,
        journal_id: str,
        teacher_id: str,
        payload: ApproveJournalRequest,
        ip_address: str | None = None,
    ) -> dict:
        """Teacher approves student journal with marks and optional remarks."""
        journal = await self.journal_repo.find_by_id(journal_id)
        if not journal:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Journal not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Concurrency Check: If student unsubmitted into draft or revoked, reject with 400
        if journal["status"] not in ["submitted", "late_submitted"] or journal.get("isRevoked", False):
            raise AppException(
                code=ErrorCode.INVALID_WORKFLOW_STATE,
                message="Cannot grade or approve a journal that is currently in draft or has been revoked by the student.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        assignment = await self.assignment_repo.find_by_id(journal["assignmentId"])
        if not assignment:
            raise AppException(code=ErrorCode.NOT_FOUND, message="Assignment not found")
        classroom = await self.classroom_repo.find_by_id(assignment["classroomId"])
        if not classroom or classroom["teacherId"] != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to grade this submission",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        now = datetime.now(timezone.utc)
        latest_rev = await self.version_repo.get_latest_revision_number(journal_id)
        new_revision = max(latest_rev + 1, journal.get("currentVersion", 1) + 1)

        await self.journal_repo.update_by_id(
            journal_id,
            {
                "$set": {
                    "status": "approved",
                    "marks": payload.marks,
                    "teacherRemarks": payload.remarks,
                    "approvedAt": now,
                    "currentVersion": new_revision,
                    "updatedAt": now,
                }
            },
        )

        await self.version_repo.create_snapshot(
            journal_id=journal_id,
            author_id=teacher_id,
            status="approved",
            blocks=journal.get("blocks", []),
            title=journal.get("title", "Approved Journal"),
            revision_number=new_revision,
            remarks=payload.remarks,
        )

        from app.repositories.notification_repository import NotificationRepository
        notification_repo = NotificationRepository()
        exp_num = assignment.get("experimentNumber", 1)
        max_marks = assignment.get("maxMarks", 10)
        approve_msg = f"Experiment #{exp_num} approved! Marks awarded: {payload.marks}/{max_marks}."
        approve_link = f"/editor/{journal_id}"
        approve_metadata = {
            "entityType": "journals",
            "entityId": journal_id,
            "classroomId": assignment["classroomId"],
            "assignmentId": assignment["id"],
            "experimentNumber": exp_num,
            "marksAwarded": payload.marks,
            "maxMarks": max_marks,
            "actionUrl": approve_link,
            "category": "approval",
        }
        notif_doc = await notification_repo.create_notification(
            user_id=journal["studentId"],
            title="Journal Approved",
            message=approve_msg,
            type_str="approval",
            link=approve_link,
            metadata=approve_metadata,
        )

        try:
            from app.core.websocket_manager import websocket_manager
            await websocket_manager.send_personal_notification(
                journal["studentId"],
                {
                    "type": "NEW_NOTIFICATION",
                    "notification": {
                        "id": notif_doc["id"],
                        "userId": journal["studentId"],
                        "title": "Journal Approved",
                        "message": approve_msg,
                        "type": "approval",
                        "isRead": False,
                        "link": approve_link,
                        "metadata": approve_metadata,
                        "createdAt": notif_doc["createdAt"].isoformat(),
                    },
                },
            )
        except Exception:
            pass

        await self.audit_repo.log_event(
            user_id=teacher_id,
            action="JOURNAL_APPROVED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)

    async def get_journal_versions(
        self, journal_id: str, user_id: str, user_role: str
    ) -> list[dict]:
        """Fetch all historical revision snapshots for a journal, ordered chronologically (latest first)."""
        await self.get_journal_by_id(journal_id, user_id, user_role)
        return await self.version_repo.find_many(
            {"journalId": journal_id},
            sort=[("revisionNumber", -1)],
        )

    async def restore_version_snapshot(
        self, journal_id: str, revision_number: int, student_id: str, ip_address: str | None = None
    ) -> dict:
        """Restore a historical version snapshot to be the active journal state (Student only)."""
        journal = await self._validate_journal_ownership_and_state(journal_id, student_id)
        
        target_version = await self.version_repo.find_one(
            {"journalId": journal_id, "revisionNumber": revision_number}
        )
        if not target_version:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message=f"Revision #{revision_number} not found for this journal",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        restored_blocks = target_version.get("blocks", [])
        current_blocks = journal.get("blocks", [])

        # Deduplication Check: If target restored blocks match active journal blocks, skip creating duplicate snapshot
        def _get_blocks_hash(b_list: list) -> str:
            return hashlib.sha256(json.dumps(b_list, sort_keys=True, default=str).encode("utf-8")).hexdigest()

        if _get_blocks_hash(restored_blocks) == _get_blocks_hash(current_blocks):
            # Document is already in specified revision state - return active journal without creating duplicate snapshot
            return journal

        now = datetime.now(timezone.utc)
        latest_rev = await self.version_repo.get_latest_revision_number(journal_id)
        new_rev = latest_rev + 1

        success = await self.journal_repo.update_by_id(
            journal_id,
            {
                "$set": {
                    "blocks": restored_blocks,
                    "title": target_version.get("title", journal["title"]),
                    "currentVersion": new_rev,
                    "updatedAt": now,
                }
            }
        )
        if not success:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to restore version snapshot",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Create new revision snapshot recording the restore operation (RULE-VER05)
        await self.version_repo.create_snapshot(
            journal_id=journal_id,
            author_id=student_id,
            status=journal["status"],
            blocks=restored_blocks,
            title=target_version.get("title", journal["title"]),
            revision_number=new_rev,
            remarks=f"Restored state from Revision #{revision_number}",
        )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_RESTORED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)

    async def create_checkpoint(
        self, journal_id: str, student_id: str, remarks: str | None = None, ip_address: str | None = None
    ) -> dict:
        """Manually create a revision snapshot milestone for current journal state (Student only)."""
        journal = await self._validate_journal_ownership_and_state(journal_id, student_id)
        
        now = datetime.now(timezone.utc)
        latest_rev = await self.version_repo.get_latest_revision_number(journal_id)
        new_rev = latest_rev + 1

        await self.journal_repo.update_by_id(
            journal_id,
            {"$set": {"currentVersion": new_rev, "updatedAt": now}}
        )

        snapshot = await self.version_repo.create_snapshot(
            journal_id=journal_id,
            author_id=student_id,
            status=journal["status"],
            blocks=journal.get("blocks", []),
            title=journal.get("title", "Untitled Journal"),
            revision_number=new_rev,
            remarks=remarks or "Manual checkpoint snapshot",
        )

        await self.audit_repo.log_event(
            user_id=student_id,
            action="CHECKPOINT_CREATED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return snapshot

    async def get_classroom_submissions(
        self, classroom_id: str, teacher_id: str
    ) -> list[dict]:
        """Fetch all submitted or graded student journals for a classroom (Teacher dashboard)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom or classroom["teacherId"] != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You do not own this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        assignments = await self.assignment_repo.find_many({"classroomId": classroom_id})
        assignment_ids = [a["id"] for a in assignments]
        if not assignment_ids:
            return []

        journals = await self.journal_repo.find_many(
            {"assignmentId": {"$in": assignment_ids}},
            limit=1000,
        )

        assignment_map = {a["id"]: a for a in assignments}
        enriched = []
        for j in journals:
            student = await self.user_repo.find_by_id(j["studentId"])
            student_profile = student.get("profile", {}) if student else {}
            student_name = student_profile.get("name") or (student["name"] if student and "name" in student else None) or (student["email"] if student else "Student")
            enrollment = student_profile.get("enrollmentNumber") or "N/A"

            asg = assignment_map.get(j["assignmentId"], {})
            j["studentName"] = student_name
            j["studentEmail"] = student.get("email") if student else None
            j["enrollmentNumber"] = enrollment
            j["studentEnrollment"] = enrollment
            j["studentBatch"] = student_profile.get("batch") or "N/A"
            j["experimentNumber"] = asg.get("experimentNumber", 1)
            j["assignmentTitle"] = asg.get("title", "Practical")
            j["maxMarks"] = asg.get("maxMarks", 10)
            enriched.append(j)

        return enriched
