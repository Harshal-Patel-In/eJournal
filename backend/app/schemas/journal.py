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
    clientRevision: int = Field(default=1, description="Client document revision number for optimistic concurrency")


class SingleBlockUpdateRequest(BaseModel):
    """Payload for incremental single block update."""

    content: Dict[str, Any] = Field(default_factory=dict, description="Updated block content attributes")
    clientRevision: int = Field(..., description="Expected client revision before mutation")


class BatchBlockUpdateRequest(BaseModel):
    """Payload for batch block update with optional title update."""

    title: str | None = Field(default=None, description="Updated journal title if changed")
    blocks: List[JournalBlock] = Field(..., description="Complete array of blocks")
    clientRevision: int = Field(..., description="Expected client revision before mutation")


class BlockOrderUpdateRequest(BaseModel):
    """Payload for updating block ordering."""

    blockOrder: List[str] = Field(..., description="Ordered list of block IDs")
    clientRevision: int = Field(..., description="Expected client revision before mutation")


class BlockUpdateResponse(BaseModel):
    """Response envelope after updating a block or document revision."""

    journalId: str
    serverRevision: int
    savedAt: datetime


class JournalResponse(BaseModel):
    """Response envelope for retrieving journal document state."""

    id: str
    assignmentId: str
    studentId: str
    title: str
    status: str
    currentVersion: int = Field(default=1, description="Current server revision counter")
    activeRevisionNumber: int = Field(default=1, description="Academic revision milestone number")
    blocks: List[JournalBlock]
    marks: float | None = Field(default=None, description="Evaluation score awarded by teacher")
    teacherRemarks: str | None = Field(default=None, description="Teacher feedback remarks")
    approvedAt: datetime | None = Field(default=None, description="Timestamp of approval")
    submittedAt: datetime | None = Field(default=None, description="Timestamp of submission")
    isLate: bool | None = Field(default=False, description="Flag indicating late submission")
    delaySeconds: int | None = Field(default=0, description="Delay in seconds if submitted late")
    annotationCounts: Dict[str, int] | None = Field(default=None, description="Breakdown of block annotation counts by type")
    createdAt: datetime
    updatedAt: datetime


class CheckpointCreateRequest(BaseModel):
    """Payload to create a manual revision snapshot checkpoint."""

    remarks: str | None = Field(default=None, description="Optional label or note describing the milestone")



