"""Gradebook and Student Analytics API Router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC controls routes.
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.dependencies.auth import RoleChecker, get_active_user
from app.schemas.response import ApiResponse, success_response
from app.services.gradebook_service import GradebookService

router = APIRouter()


@router.get("/classrooms/{classroomId}/gradebook", response_model=ApiResponse[dict])
async def get_classroom_gradebook(
    classroomId: str,
    batch: str | None = Query(None, description="Optional batch filter (e.g. B1, B2)"),
    user: dict = Depends(RoleChecker(["teacher"])),
    gradebook_service: GradebookService = Depends(),
):
    """Retrieve 2D grading matrix for a classroom (Teacher only)."""
    data = await gradebook_service.get_classroom_gradebook(classroomId, user["id"], batch)
    return success_response(data)


@router.get("/classrooms/{classroomId}/gradebook/export/csv")
async def export_gradebook_csv(
    classroomId: str,
    batch: str | None = Query(None, description="Optional batch filter (e.g. B1, B2)"),
    user: dict = Depends(RoleChecker(["teacher"])),
    gradebook_service: GradebookService = Depends(),
) -> StreamingResponse:
    """Stream official CSV gradebook export for faculty reporting (Teacher only)."""
    return await gradebook_service.export_gradebook_csv(classroomId, user["id"], batch)


@router.get("/analytics/student", response_model=ApiResponse[dict])
async def get_student_analytics(
    user: dict = Depends(RoleChecker(["student"])),
    gradebook_service: GradebookService = Depends(),
):
    """Retrieve overall academic progress and performance analytics for current student."""
    analytics = await gradebook_service.get_student_analytics(user["id"])
    return success_response(analytics)
