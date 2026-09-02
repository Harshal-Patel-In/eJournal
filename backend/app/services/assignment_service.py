"""Practical Assignment management business logic service.

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
from app.schemas.assignment import AssignmentCreateRequest


class AssignmentService:
    """Practical assignments management service."""

    def __init__(self):
        self.assignment_repo = AssignmentRepository()
        self.classroom_repo = ClassroomRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.audit_repo = AuditLogRepository()

    async def publish_assignment(
        self, teacher_id: str, classroom_id: str, request: AssignmentCreateRequest
    ) -> dict:
        """Publish a new practical/experiment assignment inside a classroom (Teacher only)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.CLASSROOM_NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Verify teacher ownership (RULE-AUTH10)
        if classroom["teacherId"] != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to publish assignments in this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        # Enforce uniqueness of experimentNumber inside the classroom
        if await self.assignment_repo.is_assignment_exists(classroom_id, request.experimentNumber):
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message=f"Practical Assignment {request.experimentNumber} already exists in this classroom",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Check deadline validity (must be in future)
        deadline_utc = request.deadline if request.deadline.tzinfo is not None else request.deadline.replace(tzinfo=timezone.utc)
        if deadline_utc < datetime.now(timezone.utc):
            raise AppException(
                code=ErrorCode.VALIDATION_ERROR,
                message="Assignment deadline must be in the future",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        assignment_doc = {
            "classroomId": classroom_id,
            "experimentNumber": request.experimentNumber,
            "title": request.title.strip(),
            "aim": request.aim.strip(),
            "instructions": request.instructions.strip(),
            "maxMarks": request.maxMarks,
            "deadline": request.deadline,
            "references": request.references.strip() if request.references else None,
            "additionalNotes": request.additionalNotes.strip() if request.additionalNotes else None,
            "clusterName": request.clusterName.strip() if request.clusterName else None,
            "rubric": [r.model_dump() for r in request.rubric] if request.rubric else None,
            "createdAt": datetime.now(timezone.utc),
        }

        assignment_id = await self.assignment_repo.insert_one(assignment_doc)

        # Notify enrolled students (in-app notifications and email dispatch)
        from app.repositories.notification_repository import NotificationRepository
        from app.repositories.user_repository import UserRepository
        from app.utils.email import send_notification_email

        notification_repo = NotificationRepository()
        user_repo = UserRepository()

        enrolled_students = await self.membership_repo.find_members_by_classroom_id(classroom_id)
        for student_member in enrolled_students:
            student_id = student_member["studentId"]
            student = await user_repo.find_by_id(student_id)
            if not student:
                continue

            # 1. Dispatch In-App Notification & WebSocket
            msg = f"Experiment #{request.experimentNumber}: {request.title} has been published in {classroom['name']}."
            link = f"/classrooms/{classroom_id}"
            metadata = {
                "entityType": "classrooms",
                "entityId": classroom_id,
                "assignmentId": assignment_id,
                "experimentNumber": request.experimentNumber,
                "actionUrl": link,
                "category": "assignment",
            }
            notif_doc = await notification_repo.create_notification(
                user_id=student_id,
                title="New Assignment Published",
                message=msg,
                type_str="assignment",
                link=link,
                metadata=metadata,
            )

            try:
                from app.core.websocket_manager import websocket_manager
                await websocket_manager.send_personal_notification(
                    student_id,
                    {
                        "type": "NEW_NOTIFICATION",
                        "notification": {
                            "id": notif_doc["id"],
                            "userId": student_id,
                            "title": "New Assignment Published",
                            "message": msg,
                            "type": "assignment",
                            "isRead": False,
                            "link": link,
                            "metadata": metadata,
                            "createdAt": notif_doc["createdAt"].isoformat(),
                        },
                    },
                )
            except Exception:
                pass

            # 2. Dispatch Email Notification
            email_subject = f"New Lab Assignment: {request.title} (Exp #{request.experimentNumber})"
            student_profile = student.get("profile", {})
            student_name = student_profile.get("name", "Student")
            deadline_str = (
                request.deadline.strftime("%Y-%m-%d %H:%M:%S")
                if hasattr(request.deadline, "strftime")
                else str(request.deadline)
            )

            email_body = f"""
            <html>
                <body style="font-family: sans-serif; padding: 20px; color: #171717;">
                    <h2 style="color: #212529;">New Practical Assignment Published</h2>
                    <p>Hello <strong>{student_name}</strong>,</p>
                    <p>Your instructor has published a new lab assignment in classroom <strong>{classroom['name']}</strong>:</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6;">
                        <h3 style="margin-top: 0; color: #0d6efd;">Experiment #{request.experimentNumber}: {request.title}</h3>
                        <p><strong>Aim:</strong> {request.aim}</p>
                        <p><strong>Deadline:</strong> {deadline_str}</p>
                    </div>
                    <p>Please log in to your dashboard to start writing your journal report.</p>
                    <br/>
                    <p style="color: #6c757d; font-size: 12px;">This is an automated notification from eJournal. Please do not reply.</p>
                </body>
            </html>
            """
            await send_notification_email(student["email"], email_subject, email_body)

        # Log event
        await self.audit_repo.log_event(
            user_id=teacher_id,
            action="ASSIGNMENT_PUBLISHED",
            entity="assignments",
            entity_id=assignment_id,
        )

        return await self.assignment_repo.find_by_id(assignment_id)

    async def list_assignments(
        self, classroom_id: str, user_id: str, role: str
    ) -> list[dict]:
        """List assignments for a classroom. Enforces member/creator access controls."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.CLASSROOM_NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Validate classroom membership boundaries (RULE-AUTH09/10)
        if role == "teacher" and classroom["teacherId"] != user_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Access denied to this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        elif role == "student" and not await self.membership_repo.is_member(classroom_id, user_id):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not enrolled in this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        return await self.assignment_repo.find_by_classroom_id(classroom_id)

    async def get_assignment(
        self, assignment_id: str, user_id: str, role: str
    ) -> dict:
        """Retrieve assignment details and verify classroom membership."""
        assignment = await self.assignment_repo.find_by_id(assignment_id)
        if not assignment:
            raise AppException(
                code=ErrorCode.ASSIGNMENT_NOT_FOUND,
                message="Practical Assignment not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Re-use membership validation using classroomId of the assignment
        await self.list_assignments(assignment["classroomId"], user_id, role)

        return assignment

    async def update_assignment_cluster(
        self, teacher_id: str, classroom_id: str, assignment_id: str, cluster_name: str | None
    ) -> dict:
        """Update or uncluster an individual practical assignment (Teacher only)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom or classroom.get("teacherId") != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to manage clusters in this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        assignment = await self.assignment_repo.find_by_id(assignment_id)
        if not assignment or assignment.get("classroomId") != classroom_id:
            raise AppException(
                code=ErrorCode.ASSIGNMENT_NOT_FOUND,
                message="Assignment not found in this classroom",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        cleaned_cluster = cluster_name.strip() if cluster_name and cluster_name.strip() else None
        await self.assignment_repo.update_by_id(
            assignment_id, {"$set": {"clusterName": cleaned_cluster}}
        )

        assignment["clusterName"] = cleaned_cluster
        return assignment

    async def bulk_assign_cluster(
        self, teacher_id: str, classroom_id: str, assignment_ids: list[str], cluster_name: str | None
    ) -> dict:
        """Assign or uncluster multiple practicals in a batch (Teacher only)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom or classroom.get("teacherId") != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to manage clusters in this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        cleaned_cluster = cluster_name.strip() if cluster_name and cluster_name.strip() else None
        from bson import ObjectId
        obj_ids = [ObjectId(aid) for aid in assignment_ids if ObjectId.is_valid(aid)]

        modified_count = await self.assignment_repo.update_many(
            {"_id": {"$in": obj_ids}, "classroomId": classroom_id},
            {"$set": {"clusterName": cleaned_cluster}}
        )

        return {"updatedCount": modified_count, "clusterName": cleaned_cluster}

    async def disband_cluster(
        self, teacher_id: str, classroom_id: str, cluster_name: str
    ) -> dict:
        """Disband a cluster non-destructively by setting clusterName to None (Teacher only)."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom or classroom.get("teacherId") != teacher_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to manage clusters in this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        modified_count = await self.assignment_repo.update_many(
            {"classroomId": classroom_id, "clusterName": cluster_name},
            {"$set": {"clusterName": None}}
        )

        return {"disbandedCount": modified_count, "clusterName": cluster_name}
