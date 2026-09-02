"""Practical Assignment catalog and creation API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC limits publishing to teachers only.
"""

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.assignment import (
    AssignmentBulkClusterRequest,
    AssignmentClusterUpdateRequest,
    AssignmentCreateRequest,
    AssignmentResponse,
)
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


@router.patch(
    "/classrooms/{classroomId}/assignments/{assignmentId}/cluster",
    response_model=ApiResponse[AssignmentResponse],
)
async def update_assignment_cluster(
    classroomId: str,
    assignmentId: str,
    payload: AssignmentClusterUpdateRequest,
    user: dict = Depends(RoleChecker(["teacher"])),
    assignment_service: AssignmentService = Depends(),
):
    """Assign, reassign, or uncluster an individual assignment (Teacher only)."""
    updated = await assignment_service.update_assignment_cluster(
        user["id"], classroomId, assignmentId, payload.clusterName
    )
    return success_response(updated)


@router.post(
    "/classrooms/{classroomId}/clusters/bulk-assign",
    response_model=ApiResponse[dict],
)
async def bulk_assign_cluster(
    classroomId: str,
    payload: AssignmentBulkClusterRequest,
    user: dict = Depends(RoleChecker(["teacher"])),
    assignment_service: AssignmentService = Depends(),
):
    """Assign or uncluster multiple assignments in a batch (Teacher only)."""
    result = await assignment_service.bulk_assign_cluster(
        user["id"], classroomId, payload.assignmentIds, payload.clusterName
    )
    return success_response(result)


@router.post(
    "/classrooms/{classroomId}/clusters/disband",
    response_model=ApiResponse[dict],
)
async def disband_cluster(
    classroomId: str,
    payload: AssignmentClusterUpdateRequest,
    user: dict = Depends(RoleChecker(["teacher"])),
    assignment_service: AssignmentService = Depends(),
):
    """Disband a cluster non-destructively, returning assignments to unclustered (Teacher only)."""
    if not payload.clusterName:
        from app.core.constants import ErrorCode
        from app.middleware.error_handler import AppException
        raise AppException(
            code=ErrorCode.VALIDATION_ERROR,
            message="clusterName is required to disband",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    result = await assignment_service.disband_cluster(
        user["id"], classroomId, payload.clusterName
    )
    return success_response(result)
