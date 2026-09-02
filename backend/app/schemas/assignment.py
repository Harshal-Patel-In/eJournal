"""Pydantic schemas for practical assignment publishing and views."""

from datetime import datetime
from pydantic import BaseModel, Field


class RubricCriterion(BaseModel):
    """Evaluation criterion definition for rubric-based grading."""

    id: str = Field(..., description="Unique criterion identifier e.g. 'c1'")
    title: str = Field(..., min_length=1, description="e.g. 'Aim, Theory & Circuit'")
    maxMarks: float = Field(..., ge=0.5, le=100, description="Marks allotted to this criterion")
    description: str | None = Field(default=None, description="Guidance notes for scoring")


class AssignmentClusterUpdateRequest(BaseModel):
    """Payload to assign or remove an assignment from a cluster."""

    clusterName: str | None = Field(default=None, description="Cluster name or null to uncluster")


class AssignmentBulkClusterRequest(BaseModel):
    """Payload to assign multiple assignments to a cluster simultaneously."""

    assignmentIds: list[str] = Field(..., min_length=1)
    clusterName: str | None = Field(default=None, description="Cluster name or null to uncluster all")


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
    clusterName: str | None = Field(default=None, description="Optional evaluation cluster or module name")
    rubric: list[RubricCriterion] | None = Field(default=None, description="Optional evaluation rubric criteria")


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
    clusterName: str | None = None
    rubric: list[RubricCriterion] | None = None
    createdAt: datetime
