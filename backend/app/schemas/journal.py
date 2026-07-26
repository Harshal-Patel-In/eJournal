"""Pydantic validation schemas for Visual Block Document Editor (Journal and Blocks)."""

from datetime import datetime
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class JournalBlock(BaseModel):
    """Schema representing an individual document block."""

    id: str = Field(..., description="Unique client-generated block ID (UUID)")
    type: str = Field(..., description="Block type (heading, paragraph, table, image, code, observation, result, reference, divider, page_break, equation)")
    content: Dict[str, Any] = Field(default_factory=dict, description="Block type-specific key-value attributes")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Block metadata (creation date, styling, comments)")


class JournalCreateRequest(BaseModel):
    """Payload to initialize a new journal draft (Student only)."""

    assignmentId: str = Field(..., description="The ID of the practical assignment to submit for")


class JournalSaveRequest(BaseModel):
    """Payload to sync/save current block state (Student only)."""

    title: str = Field(..., description="Title of the journal")
    blocks: List[JournalBlock] = Field(default_factory=list, description="Array of document blocks")


class JournalResponse(BaseModel):
    """Response envelope for retrieving journal document state."""

    id: str
    assignmentId: str
    studentId: str
    title: str
    status: str
    currentVersion: int
    blocks: List[JournalBlock]
    createdAt: datetime
    updatedAt: datetime
