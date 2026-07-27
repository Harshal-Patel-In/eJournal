"""Pydantic schemas for practical assignment publishing and views."""

from datetime import datetime
from pydantic import BaseModel, Field


class AssignmentCreateRequest(BaseModel):
    """Payload to publish a new practical assignment in a classroom (Teacher only)."""

    experimentNumber: int = Field(..., ge=1, description="Sequential practical index number")
    title: str = Field(..., min_length=2, max_length=200)
    aim: str = Field(..., min_length=2, description="Objective of the experiment")
    instructions: str = Field(..., description="Instructions, steps or procedures")
    maxMarks: int = Field(..., ge=1, le=100, description="Maximum scale grade points")
    deadline: datetime = Field(..., description="Cut-off date and time for submission")
    references: str | None = Field(default=None, description="Optional reading materials links or citations")
    additionalNotes: str | None = Field(default=None)


class AssignmentResponse(BaseModel):
    """Detailed response schema for published assignments."""

    id: str
    classroomId: str
    experimentNumber: int
    title: str
    aim: str
    instructions: str
    maxMarks: int
    deadline: datetime
    references: str | None = None
    additionalNotes: str | None = None
    createdAt: datetime
