"""Administrator API router providing institutional governance endpoints.

RULE-API02: Versioned API endpoints under /api/v1/admin.
RULE-AUTH07: Strictly guarded by RoleChecker(["admin"]).
RULE-SEC10: All critical admin workflows log security audit events.
"""

from fastapi import APIRouter, Depends, Query, Request
from app.core.constants import ErrorCode
from app.dependencies.auth import RoleChecker
from app.schemas.admin import (
    AdminPasswordChangeRequest,
    ClassroomReassignRequest,
    FacultyAdminRoleRequest,
    FacultyCreateRequest,
    PasswordResetRequest,
    UserStatusUpdateRequest,
)
from app.schemas.response import ApiResponse, success_response
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=ApiResponse[dict])
async def get_admin_stats(
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Retrieve overall university platform KPIs, system health, and recent activity stream."""
    data = await admin_service.get_system_stats()
    return success_response(data)


@router.get("/users", response_model=ApiResponse[dict])
async def list_users(
    role: str | None = Query(None, description="Filter by role (student | teacher | admin)"),
    search: str | None = Query(None, description="Multi-field keyword search"),
    department: str | None = Query(None, description="Filter by department"),
    status: str | None = Query(None, description="Filter by status (active | suspended | pending_setup | unverified)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Search and browse users across the campus directory."""
    skip = (page - 1) * limit
    data = await admin_service.list_users(
        role=role, search=search, department=department, status_filter=status, skip=skip, limit=limit
    )
    return success_response(data)


@router.post("/faculty", response_model=ApiResponse[dict])
async def create_faculty(
    payload: FacultyCreateRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Directly onboard a verified faculty instructor and dispatch welcome credentials."""
    ip_address = request.client.host if request.client else None
    data = await admin_service.create_faculty(
        admin_user=admin_user, request=payload, ip_address=ip_address
    )
    return success_response(data)


@router.patch("/users/{id}/status", response_model=ApiResponse[dict])
async def update_user_status(
    id: str,
    payload: UserStatusUpdateRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Suspend or activate a user account."""
    ip_address = request.client.host if request.client else None
    data = await admin_service.update_user_status(
        admin_user=admin_user, user_id=id, new_status=payload.status, ip_address=ip_address
    )
    return success_response(data)


@router.post("/users/{id}/reset-password", response_model=ApiResponse[dict])
async def reset_user_password(
    id: str,
    payload: PasswordResetRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Emergency administrative password reset."""
    ip_address = request.client.host if request.client else None
    data = await admin_service.reset_user_password(
        admin_user=admin_user,
        user_id=id,
        custom_password=payload.newPassword,
        ip_address=ip_address,
    )
    return success_response(data)


@router.post("/change-password", response_model=ApiResponse[dict])
async def change_admin_password(
    payload: AdminPasswordChangeRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Self-service password update for administrator."""
    ip_address = request.client.host if request.client else None
    data = await admin_service.change_self_password(
        user=admin_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        ip_address=ip_address,
    )
    return success_response(data)



@router.get("/classrooms", response_model=ApiResponse[dict])
async def list_classrooms(
    search: str | None = Query(None, description="Search by subject code, name, or join code"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """List all campus academic lab classrooms with instructor and enrollment counts."""
    skip = (page - 1) * limit
    data = await admin_service.list_classrooms(search=search, skip=skip, limit=limit)
    return success_response(data)


@router.patch("/classrooms/{id}/reassign", response_model=ApiResponse[dict])
async def reassign_classroom(
    id: str,
    payload: ClassroomReassignRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Reassign classroom ownership to another faculty member preserving all historical records."""
    ip_address = request.client.host if request.client else None
    data = await admin_service.reassign_classroom(
        admin_user=admin_user,
        classroom_id=id,
        new_teacher_id=payload.newTeacherId,
        ip_address=ip_address,
    )
    return success_response(data)


@router.get("/journals", response_model=ApiResponse[dict])
async def list_journals(
    classroomId: str | None = Query(None, description="Filter by classroom"),
    status: str | None = Query(None, description="Filter by status (draft, submitted, approved, etc.)"),
    search: str | None = Query(None, description="Search journals"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Global academic journal inspection registry across all lifecycle states."""
    skip = (page - 1) * limit
    data = await admin_service.list_journals(
        classroom_id=classroomId,
        status_filter=status,
        search=search,
        skip=skip,
        limit=limit,
    )
    return success_response(data)


@router.get("/audit-logs", response_model=ApiResponse[dict])
async def list_audit_logs(
    action: str | None = Query(None, description="Filter by action event type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Immutable security audit trail with client IP and actor tracking."""
    skip = (page - 1) * limit
    data = await admin_service.list_audit_logs(action_filter=action, skip=skip, limit=limit)
    return success_response(data)


@router.delete("/users/{user_id}", response_model=ApiResponse[dict])
async def delete_user(
    user_id: str,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Permanently delete a user and purge all cascading data (journals, assets, Cloudinary images)."""
    ip_address = request.client.host if request.client else None
    result = await admin_service.delete_user(
        admin_user=admin_user, user_id=user_id, ip_address=ip_address
    )
    return success_response(result)


@router.patch("/faculty/{user_id}/admin-role", response_model=ApiResponse[dict])
async def toggle_faculty_admin_role(
    user_id: str,
    payload: FacultyAdminRoleRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
    admin_service: AdminService = Depends(),
):
    """Grant or revoke administrative authority for a faculty member."""
    ip_address = request.client.host if request.client else None
    result = await admin_service.toggle_faculty_admin_role(
        admin_user=admin_user,
        user_id=user_id,
        is_admin=payload.isAdmin,
        ip_address=ip_address,
    )
    return success_response(result)

