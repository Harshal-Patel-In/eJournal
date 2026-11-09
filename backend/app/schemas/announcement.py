"""Pydantic schemas for Classroom and Campus Broadcast Announcements."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class AnnouncementCreateRequest(BaseModel):
    """Payload to post a classroom announcement (Teacher only)."""

    title: str = Field(..., min_length=2, max_length=150)
    content: str = Field(..., min_length=2, max_length=2000)
    targetBatch: str | None = Field(default=None, description="Specific batch name or null for all batches")


class AnnouncementResponse(BaseModel):
    """Announcement item payload."""

    id: str
    classroomId: str
    authorId: str
    authorName: str
    title: str
    content: str
    targetBatch: str | None = None
    createdAt: datetime


class AnnouncementActionSchema(BaseModel):
    """Interactive client-side action specification for campus announcements."""

    actionType: Literal["none", "link", "modal", "acknowledge"] = "none"
    actionLabel: str | None = None
    actionUrl: str | None = None
    modalContent: str | None = None
    requiresAcknowledgment: bool = False


class BroadcastAnnouncementCreateRequest(BaseModel):
    """Payload to dispatch a campus-wide broadcast announcement (Admin only)."""

    title: str = Field(..., min_length=2, max_length=150)
    content: str = Field(..., min_length=2, max_length=2000)
    category: Literal["general_info", "academic_deadline", "system_alert", "action_required"] = "general_info"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    targetRoles: list[str] = Field(default=["all"], description="Target audience: ['all', 'student', 'teacher']")
    action: AnnouncementActionSchema = Field(default_factory=AnnouncementActionSchema)
    expiresInHours: int = Field(default=24, ge=1, le=720, description="Active banner duration in hours")


class BroadcastAnnouncementResponse(BaseModel):
    """Broadcast announcement returned to users and admins."""

    id: str
    title: str
    content: str
    category: str
    priority: str
    targetRoles: list[str]
    action: AnnouncementActionSchema
    isActive: bool
    startsAt: datetime
    expiresAt: datetime
    acknowledgedCount: int = 0
    isAcknowledged: bool = False
    createdAt: datetime

