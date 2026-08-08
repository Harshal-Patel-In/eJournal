"""Classroom management and Student Enrollment API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC controls classroom routes.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.announcement import AnnouncementCreateRequest
from app.schemas.classroom import (
    ClassroomCreateRequest,
    ClassroomJoinRequest,
    ClassroomMemberResponse,
    ClassroomResponse,
)
from app.schemas.response import ApiResponse, success_response
from app.services.announcement_service import AnnouncementService
from app.services.classroom_service import ClassroomService

router = APIRouter(prefix="/classrooms")


@router.post(
    "",
    response_model=ApiResponse[ClassroomResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_classroom(
    payload: ClassroomCreateRequest,
    user: dict = Depends(RoleChecker(["teacher"])),
    classroom_service: ClassroomService = Depends(),
):
    """Create a new classroom and generate a unique join code (Teacher only)."""
    classroom = await classroom_service.create_classroom(user["id"], payload)
    return success_response(classroom)


@router.get("", response_model=ApiResponse[list[ClassroomResponse]])
async def list_classrooms(
    user: dict = Depends(get_active_user),
    classroom_service: ClassroomService = Depends(),
):
    """List classrooms matching active user enrollment or creation ownership."""
    classrooms = await classroom_service.list_classrooms(user["id"], user["role"])
    return success_response(classrooms)


@router.get("/{classroomId}", response_model=ApiResponse[ClassroomResponse])
async def get_classroom(
    classroomId: str,
    user: dict = Depends(get_active_user),
    classroom_service: ClassroomService = Depends(),
):
    """Retrieve classroom details (authorized to enrolled students/creator teacher)."""
    classroom = await classroom_service.get_classroom(
        classroomId, user["id"], user["role"]
    )
    return success_response(classroom)


@router.post("/join", response_model=ApiResponse[ClassroomResponse])
async def join_classroom(
    payload: ClassroomJoinRequest,
    user: dict = Depends(RoleChecker(["student"])),
    classroom_service: ClassroomService = Depends(),
):
    """Enroll a student in a classroom using its unique join code (Student only)."""
    classroom = await classroom_service.join_classroom(user["id"], payload.joinCode)
    return success_response(classroom)


@router.get("/{classroomId}/members", response_model=ApiResponse[list[ClassroomMemberResponse]])
async def list_members(
    classroomId: str,
    user: dict = Depends(get_active_user),
    classroom_service: ClassroomService = Depends(),
):
    """List all students enrolled inside a classroom."""
    members = await classroom_service.list_members(
        classroomId, user["id"], user["role"]
    )
    return success_response(members)


@router.post(
    "/{classroomId}/announcements",
    response_model=ApiResponse[dict],
    status_code=status.HTTP_201_CREATED,
)
async def create_announcement(
    classroomId: str,
    payload: AnnouncementCreateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(RoleChecker(["teacher"])),
    announcement_service: AnnouncementService = Depends(),
):
    """Post a new classroom announcement (Teacher only)."""
    announcement = await announcement_service.create_announcement(
        classroomId, user["id"], payload, background_tasks
    )
    return success_response(announcement)


@router.get("/{classroomId}/announcements", response_model=ApiResponse[list])
async def list_announcements(
    classroomId: str,
    user: dict = Depends(get_active_user),
    announcement_service: AnnouncementService = Depends(),
):
    """List announcements for a classroom."""
    announcements = await announcement_service.list_announcements(classroomId, user)
    return success_response(announcements)
