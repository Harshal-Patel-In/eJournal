"""Practical Assignment catalog and creation API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC limits publishing to teachers only.
"""

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.assignment import AssignmentCreateRequest, AssignmentResponse
from app.schemas.response import ApiResponse, success_response
from app.services.assignment_service import AssignmentService

router = APIRouter()


@router.post(
    "/classrooms/{classroomId}/assignments",
    response_model=ApiResponse[AssignmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def publish_assignment(
    classroomId: str,
    payload: AssignmentCreateRequest,
    user: dict = Depends(RoleChecker(["teacher"])),
    assignment_service: AssignmentService = Depends(),
):
    """Publish a new practical/experiment assignment inside a classroom (Teacher only)."""
    assignment = await assignment_service.publish_assignment(
        user["id"], classroomId, payload
    )
    return success_response(assignment)


@router.get(
    "/classrooms/{classroomId}/assignments",
    response_model=ApiResponse[list[AssignmentResponse]],
)
async def list_assignments(
    classroomId: str,
    user: dict = Depends(get_active_user),
    assignment_service: AssignmentService = Depends(),
):
    """List assignments published inside a classroom."""
    assignments = await assignment_service.list_assignments(
        classroomId, user["id"], user["role"]
    )
    return success_response(assignments)


@router.get("/assignments/{id}", response_model=ApiResponse[AssignmentResponse])
async def get_assignment(
    id: str,
    user: dict = Depends(get_active_user),
    assignment_service: AssignmentService = Depends(),
):
    """Retrieve details for a specific practical assignment."""
    assignment = await assignment_service.get_assignment(
        id, user["id"], user["role"]
    )
    return success_response(assignment)
