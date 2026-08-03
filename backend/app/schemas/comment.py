"""Pydantic validation schemas for Teacher Review, Comments, Suggestions, and Approval Workflows."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CommentCreateRequest(BaseModel):
    """Payload to create a block comment or suggestion."""

    journalId: str = Field(..., description="ID of the journal document")
    blockId: str = Field(..., description="ID of the document block to annotate")
    type: str = Field(
        default="comment",
        description="Comment type: comment, suggestion, highlight, warning, question",
    )
    message: str = Field(..., description="Text content of the comment or suggestion")
    suggestedContent: Optional[Dict[str, Any]] = Field(
        default=None, description="Proposed replacement block content for suggestions"
    )
    parentCommentId: Optional[str] = Field(
        default=None, description="Parent comment ID if replying to a thread"
    )


class CommentResponse(BaseModel):
    """Response envelope for a comment record."""

    id: str
    journalId: str
    blockId: str
    authorId: str
    authorName: str
    authorRole: str
    type: str
    message: str
    suggestedContent: Optional[Dict[str, Any]] = None
    status: str = Field(default="open", description="Comment status: open or resolved")
    parentCommentId: Optional[str] = None
    createdAt: datetime


class RequestChangesRequest(BaseModel):
    """Payload when a teacher requests changes on a student submission."""

    remarks: str = Field(..., description="Overall remarks detailing required corrections")


class ApproveJournalRequest(BaseModel):
    """Payload when a teacher approves a student journal submission."""

    marks: float = Field(..., ge=0, description="Grade / marks awarded for the journal")
    remarks: Optional[str] = Field(default=None, description="Optional teacher feedback remarks")
