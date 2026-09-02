"""Pydantic schemas for Classroom and Membership operations."""

from datetime import datetime
from pydantic import BaseModel, Field


class ClassroomCreateRequest(BaseModel):
    """Payload to create a new classroom (Teacher only)."""

    name: str = Field(..., min_length=2, max_length=100, description="e.g. Operating Systems Practicals")
    subject: str = Field(..., min_length=2, max_length=100, description="e.g. Computer Science")
    semester: str = Field(..., description="e.g. Semester V")
    division: str = Field(..., description="e.g. Division A")
    department: str = Field(..., description="e.g. Computer Engineering")
    batches: list[str] = Field(default_factory=list, description="e.g. ['Batch A1', 'Batch A2']")


class ClassroomResponse(BaseModel):
    """Response envelope payload containing classroom details."""

    id: str
    name: str
    subject: str
    semester: str
    division: str
    department: str
    teacherId: str
    joinCode: str
    batches: list[str] = Field(default_factory=list)
    createdAt: datetime


class ClassroomJoinRequest(BaseModel):
    """Payload containing joinCode to enroll in a classroom (Student only)."""

    joinCode: str = Field(..., min_length=4, max_length=20)


class ClassroomMemberResponse(BaseModel):
    """Summary of a student enrolled in a classroom."""

    studentId: str
    name: str | None = None
    email: str
    joinedAt: datetime
    status: str
    rollNumber: str | None = None
    division: str | None = None
    batch: str | None = None
