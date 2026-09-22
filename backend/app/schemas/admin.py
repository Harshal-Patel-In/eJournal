"""Pydantic schemas for Admin Subsystem requests and responses."""

from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, EmailStr, Field


class FacultyCreateRequest(BaseModel):
    """Request payload for directly provisioning a faculty member."""

    name: str = Field(..., min_length=2, description="Full name of professor or instructor")
    email: EmailStr = Field(..., description="Institutional email address")
    department: str = Field(..., min_length=2, description="Academic department (e.g. Computer Science)")
    designation: str = Field(
        default="Assistant Professor",
        description="Designation (e.g. Assistant Professor, Associate Professor, Head of Department, Lab Instructor)",
    )
    password: str | None = Field(
        default=None,
        min_length=8,
        description="Optional initial password. Auto-generated cryptographically if omitted.",
    )


class UserStatusUpdateRequest(BaseModel):
    """Request payload for toggling user active or suspended status."""

    status: Literal["active", "suspended"] = Field(..., description="New account status")


class PasswordResetRequest(BaseModel):
    """Request payload for administrative password reset."""

    newPassword: str | None = Field(
        default=None,
        min_length=8,
        description="Optional explicit password. Auto-generated if omitted.",
    )


class AdminPasswordChangeRequest(BaseModel):
    """Request payload for self-service password change by admin or users with must_change_password."""

    current_password: str = Field(..., min_length=1, description="Current password for verification")
    new_password: str = Field(..., min_length=8, description="New strong password (min 8 chars)")


class ClassroomReassignRequest(BaseModel):
    """Request payload for reassigning a classroom to a new faculty instructor."""

    newTeacherId: str = Field(..., min_length=1, description="Target teacher user ID")


class FacultyAdminRoleRequest(BaseModel):
    """Request payload for granting or revoking administrative authority to a faculty member."""

    isAdmin: bool = Field(..., description="Whether the faculty member has administrative access")


class SystemHealthStatus(BaseModel):

    """System health metrics."""

    environment: str
    database: str = "connected"
    redis: str = "connected"


class RecentActivityItem(BaseModel):
    """Recent platform activity event item."""

    id: str
    action: str
    entity: str
    entityId: str | None = None
    userId: str | None = None
    userEmail: str | None = None
    ipAddress: str | None = None
    timestamp: datetime


class AdminStatsData(BaseModel):
    """Overall platform KPI counters and health status."""

    totalStudents: int = 0
    totalFaculty: int = 0
    activeClassrooms: int = 0
    totalJournals: int = 0
    pendingSubmissions: int = 0
    approvedJournals: int = 0
    health: SystemHealthStatus
    recentActivity: list[RecentActivityItem] = []
