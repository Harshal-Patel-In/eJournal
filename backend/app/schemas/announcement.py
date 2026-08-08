"""Pydantic schemas for Classroom Announcements."""

from datetime import datetime
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
