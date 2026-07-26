"""Journal management and document editing business logic service.

RULE-BE04: All business logic MUST live inside service classes.
"""

from datetime import datetime, timezone
from fastapi import status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.assignment_repository import AssignmentRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.classroom_membership_repository import ClassroomMembershipRepository
from app.repositories.classroom_repository import ClassroomRepository
from app.repositories.journal_repository import JournalRepository
from app.repositories.user_repository import UserRepository
from app.schemas.journal import JournalCreateRequest, JournalSaveRequest


class JournalService:
    """Journal management workflows service."""

    def __init__(self):
        self.journal_repo = JournalRepository()
        self.assignment_repo = AssignmentRepository()
        self.classroom_repo = ClassroomRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.user_repo = UserRepository()
        self.audit_repo = AuditLogRepository()

    async def create_journal(
        self, student_id: str, request: JournalCreateRequest, ip_address: str | None = None
    ) -> dict:
        """Initialize a new visual block draft journal for an assignment (Student only)."""
        # 1. Fetch assignment details
        assignment = await self.assignment_repo.find_by_id(request.assignmentId)
        if not assignment:
            raise AppException(
                code=ErrorCode.NOT_FOUND,
                message="Assignment not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        classroom_id = assignment["classroomId"]

        # 2. Verify student is enrolled in classroom
        enrolled = await self.membership_repo.is_member(classroom_id, student_id)
        if not enrolled:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not enrolled in the classroom for this assignment",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # 3. Idempotent check: if student already started a draft, return it (prevents duplicate errors)
        existing = await self.journal_repo.find_student_journal_for_assignment(
            student_id, request.assignmentId
        )
        if existing:
            return existing

        # 4. Fetch details to build the templates
        student = await self.user_repo.find_by_id(student_id)
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        
        student_profile = student.get("profile", {})
        student_name = student_profile.get("name") or student["email"]
        enrollment = student_profile.get("enrollmentNumber") or "N/A"
        department = student_profile.get("department") or "N/A"
        semester = student_profile.get("semester") or "N/A"
        division = student_profile.get("division") or "N/A"

        subject = classroom.get("subject") or "N/A"
        experiment_num = assignment.get("experimentNumber") or 1
        aim = assignment.get("description") or "To perform the practical as per instructions."

        # 5. Populate initial Visual blocks with Cover Page meta and Aim
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

        # RBAC Check: Students can only view their own journals
        if user_role == "student":
            if journal["studentId"] != user_id:
                raise AppException(
                    code=ErrorCode.FORBIDDEN,
                    message="You are not authorized to view this journal",
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        # RBAC Check: Teachers must own the classroom associated with this journal
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

        return journal

    async def list_student_journals(self, student_id: str) -> list[dict]:
        """List all visual journals owned by the student."""
        return await self.journal_repo.find_many({"studentId": student_id})

    async def save_journal(
        self, journal_id: str, student_id: str, request: JournalSaveRequest, ip_address: str | None = None
    ) -> dict:
        """Update/Sync the block array of a journal in progress (Student only)."""
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

        # Locked documents (submitted, approved) cannot be edited
        if journal["status"] not in ["draft", "changes_requested"]:
            raise AppException(
                code=ErrorCode.INVALID_WORKFLOW_STATE,
                message="Cannot edit journal after submission or approval",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

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

        # Get updated document
        updated_journal = await self.journal_repo.find_by_id(journal_id)
        return updated_journal

    async def submit_journal(
        self, journal_id: str, student_id: str, ip_address: str | None = None
    ) -> dict:
        """Submit a journal draft for review, locking editing and notifying the teacher (Student only)."""
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

        # Enforce lifecycle limits
        if journal["status"] not in ["draft", "changes_requested"]:
            raise AppException(
                code=ErrorCode.INVALID_WORKFLOW_STATE,
                message=f"Cannot submit journal in '{journal['status']}' status",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Update status
        success = await self.journal_repo.update_by_id(
            journal_id,
            {
                "$set": {
                    "status": "submitted",
                    "submittedAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
            }
        )
        if not success:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to submit journal",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Notify the teacher (in-app notification and email alert)
        from app.repositories.notification_repository import NotificationRepository
        from app.utils.email import send_notification_email

        notification_repo = NotificationRepository()

        # Find student details
        student = await self.user_repo.find_by_id(student_id)
        student_name = student.get("profile", {}).get("name", "A Student")

        # Find assignment details
        assignment = await self.assignment_repo.find_by_id(journal["assignmentId"])
        if assignment:
            classroom = await self.classroom_repo.find_by_id(assignment["classroomId"])
            if classroom:
                teacher_id = classroom["teacherId"]
                classroom_name = classroom["name"]
                exp_num = assignment["experimentNumber"]

                # 1. In-App Notification to Teacher
                msg = f"{student_name} has handed in the journal for Experiment #{exp_num} in {classroom_name}."
                await notification_repo.create_notification(
                    user_id=teacher_id,
                    title="Journal Submission",
                    message=msg,
                    type_str="submission",
                    link=f"/classrooms/{classroom['id']}/grades?assignment={assignment['id']}"
                )

                # 2. Email alert to Teacher
                teacher = await self.user_repo.find_by_id(teacher_id)
                if teacher:
                    email_subject = f"Journal Submitted: {student_name} (Exp #{exp_num})"
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
                            </div>
                            <p>Please log in to your dashboard to grade this submission.</p>
                            <br/>
                            <p style="color: #6c757d; font-size: 12px;">This is an automated notification from eJournal. Please do not reply.</p>
                        </body>
                    </html>
                    """
                    await send_notification_email(teacher["email"], email_subject, email_body)

        # Log event
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
        """Undo a student's journal submission, unlocking it back to draft state."""
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

        # Only submitted journals can be unsubmitted (approved ones are finalized!)
        if journal["status"] != "submitted":
            raise AppException(
                code=ErrorCode.INVALID_WORKFLOW_STATE,
                message="Only submitted journals can be unsubmitted",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Transition status back to draft
        success = await self.journal_repo.update_one(
            {"_id": self.journal_repo._to_object_id(journal_id)},
            {"$set": {"status": "draft", "updatedAt": datetime.now(timezone.utc)}},
        )
        if not success:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to revert submission state",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Log event
        await self.audit_repo.log_event(
            user_id=student_id,
            action="JOURNAL_UNSUBMITTED",
            entity="journals",
            entity_id=journal_id,
            ip_address=ip_address,
        )

        return await self.journal_repo.find_by_id(journal_id)


