"""Classroom and Membership management business logic service.

RULE-BE04: All business logic MUST live inside service classes.
"""

import random
import string
from datetime import datetime, timezone

from fastapi import status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.classroom_membership_repository import ClassroomMembershipRepository
from app.repositories.classroom_repository import ClassroomRepository
from app.repositories.user_repository import UserRepository
from app.schemas.classroom import ClassroomCreateRequest


class ClassroomService:
    """Classroom and Membership workflows service."""

    def __init__(self):
        self.classroom_repo = ClassroomRepository()
        self.membership_repo = ClassroomMembershipRepository()
        self.user_repo = UserRepository()
        self.audit_repo = AuditLogRepository()

    @staticmethod
    def _generate_join_code(subject_code: str) -> str:
        """Generate a unique join code (e.g. CS401-7F2A)."""
        prefix = "".join(c for c in subject_code if c.isalnum()).upper()[:5]
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        return f"{prefix}-{suffix}"

    async def create_classroom(self, teacher_id: str, request: ClassroomCreateRequest) -> dict:
        """Create a new classroom and generate a unique join code (Teacher only)."""
        # Generate a unique join code
        attempts = 0
        join_code = ""
        while attempts < 10:
            join_code = self._generate_join_code(request.subject)
            if not await self.classroom_repo.is_join_code_exists(join_code):
                break
            attempts += 1
        else:
            raise AppException(
                code=ErrorCode.INTERNAL_ERROR,
                message="Failed to generate a unique join code, please try again",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        classroom_doc = {
            "name": request.name.strip(),
            "subject": request.subject.strip(),
            "semester": request.semester.strip(),
            "division": request.division.strip(),
            "department": request.department.strip(),
            "teacherId": teacher_id,
            "joinCode": join_code,
            "batches": [b.strip() for b in request.batches if b.strip()],
            "createdAt": datetime.now(timezone.utc),
        }

        classroom_id = await self.classroom_repo.insert_one(classroom_doc)

        await self.audit_repo.log_event(
            user_id=teacher_id,
            action="CLASSROOM_CREATED",
            entity="classrooms",
            entity_id=classroom_id,
        )

        return await self.classroom_repo.find_by_id(classroom_id)

    async def list_classrooms(self, user_id: str, role: str) -> list[dict]:
        """List classrooms associated with the active user."""
        if role == "teacher":
            return await self.classroom_repo.find_by_teacher_id(user_id)
        
        # Student: Fetch classrooms via memberships
        memberships = await self.membership_repo.find_by_student_id(user_id)
        classrooms = []
        for mem in memberships:
            classroom = await self.classroom_repo.find_by_id(mem["classroomId"])
            if classroom:
                classrooms.append(classroom)
        return classrooms

    async def get_classroom(self, classroom_id: str, user_id: str, role: str) -> dict:
        """Retrieve classroom details and verify enrollment/ownership."""
        classroom = await self.classroom_repo.find_by_id(classroom_id)
        if not classroom:
            raise AppException(
                code=ErrorCode.CLASSROOM_NOT_FOUND,
                message="Classroom not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Enforce authorization boundaries (RULE-AUTH09/10)
        if role == "teacher" and classroom["teacherId"] != user_id:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not authorized to view this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        elif role == "student" and not await self.membership_repo.is_member(classroom_id, user_id):
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="You are not enrolled in this classroom",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        return classroom

    async def join_classroom(self, student_id: str, join_code: str) -> dict:
        """Enroll a student in a classroom using its unique join code."""
        classroom = await self.classroom_repo.find_by_join_code(join_code)
        if not classroom:
            raise AppException(
                code=ErrorCode.INVALID_JOIN_CODE,
                message="Invalid classroom join code",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        classroom_id = classroom["id"]

        # Check existing membership (RULE-NC02 compound unique check)
        if await self.membership_repo.is_member(classroom_id, student_id):
            raise AppException(
                code=ErrorCode.ALREADY_ENROLLED,
                message="You are already enrolled in this classroom",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Create membership
        await self.membership_repo.add_member(classroom_id, student_id)

        # Log event
        await self.audit_repo.log_event(
            user_id=student_id,
            action="CLASSROOM_JOINED",
            entity="classroom_memberships",
            entity_id=classroom_id,
        )

        return classroom

    async def list_members(self, classroom_id: str, user_id: str, role: str) -> list[dict]:
        """List students enrolled in a classroom (Authorization validated)."""
        # Ensure user is part of classroom
        await self.get_classroom(classroom_id, user_id, role)

        memberships = await self.membership_repo.find_members_by_classroom_id(classroom_id)
        member_list = []
        for mem in memberships:
            student = await self.user_repo.find_by_id(mem["studentId"])
            if student:
                member_list.append({
                    "studentId": mem["studentId"],
                    "name": student.get("profile", {}).get("name"),
                    "email": student["email"],
                    "joinedAt": mem["joinedAt"],
                    "status": mem["status"]
                })
        return member_list
