"""Pydantic schemas for practical assignment publishing, rubric configuration, and updates."""

from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class RubricCriterion(BaseModel):
    """Evaluation criterion definition for dynamic rubric-based grading."""

    id: str = Field(..., description="Unique criterion identifier e.g. 'c1'")
    title: str = Field(..., min_length=1, max_length=100, description="e.g. 'Aim, Theory & Circuit'")
    maxMarks: float = Field(..., ge=0.5, le=100, description="Marks allotted to this criterion")
    description: str | None = Field(default=None, max_length=500, description="Guidance notes for scoring")


class AssignmentClusterUpdateRequest(BaseModel):
    """Payload to assign or remove an assignment from a cluster."""

    clusterName: str | None = Field(default=None, description="Cluster name or null to uncluster")


class AssignmentBulkClusterRequest(BaseModel):
    """Payload to assign multiple assignments to a cluster simultaneously."""

    assignmentIds: list[str] = Field(..., min_length=1)
    clusterName: str | None = Field(default=None, description="Cluster name or null to uncluster all")


class AssignmentCreateRequest(BaseModel):
    """Payload to publish or schedule a new practical assignment in a classroom (Teacher only)."""

    experimentNumber: int = Field(..., ge=1, description="Sequential practical index number")
    title: str = Field(..., min_length=2, max_length=200)
    aim: str = Field(..., min_length=2, description="Objective of the experiment")
    instructions: str = Field(..., description="Instructions, steps or procedures")
    maxMarks: int = Field(..., ge=1, le=100, description="Maximum scale grade points")
    deadline: datetime = Field(..., description="Cut-off date and time for submission")
    
    # Multi-Phase Temporal Lifecycle
    publishDate: datetime | None = Field(default=None, description="Scheduled release date or null for immediate release")
    conductedDate: datetime | None = Field(default=None, description="Date practical session is conducted in laboratory")
    allowLateSubmissions: bool = Field(default=True, description="Whether late submissions are accepted")
    lateGraceDays: int = Field(default=3, ge=0, le=30, description="Grace period days for late submissions")
    hardCutoffDate: datetime | None = Field(default=None, description="Final hard cutoff after which submissions are blocked")

    references: str | None = Field(default=None, description="Optional reading materials links or citations")
    additionalNotes: str | None = Field(default=None)
    clusterName: str | None = Field(default=None, description="Optional evaluation cluster or module name")
    targetBatches: list[str] = Field(default_factory=list, description="Target student batches e.g. ['A', 'B'] or empty for all")
    rubric: list[RubricCriterion] | None = Field(default=None, description="Configurable evaluation rubric criteria")

    @model_validator(mode="after")
    def validate_rubric_sum(self):
        """Validate that the sum of rubric criteria marks exactly matches maxMarks if rubric is provided."""
        if self.rubric and len(self.rubric) > 0:
            total_rubric = sum(c.maxMarks for c in self.rubric)
            if abs(total_rubric - self.maxMarks) > 0.05:
                raise ValueError(
                    f"Rubric criteria marks sum ({total_rubric}) must equal total maxMarks ({self.maxMarks})"
                )
        return self


class AssignmentUpdateRequest(BaseModel):
    """Payload to safely update practical assignment details, dates, or rubrics."""

    title: str | None = Field(default=None, min_length=2, max_length=200)
    aim: str | None = Field(default=None, min_length=2)
    instructions: str | None = None
    conductedDate: datetime | None = None
    deadline: datetime | None = None
    publishDate: datetime | None = None
    allowLateSubmissions: bool | None = None
    lateGraceDays: int | None = Field(default=None, ge=0, le=30)
    hardCutoffDate: datetime | None = None
    references: str | None = None
    additionalNotes: str | None = None
    clusterName: str | None = None
    targetBatches: list[str] | None = None
    rubric: list[RubricCriterion] | None = None
    notifyStudents: bool = Field(default=True, description="Whether to send real-time notification to students")
    changeReason: str | None = Field(default=None, max_length=300, description="e.g. 'Deadline extended due to college holiday'")


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
    publishDate: datetime | None = None
    conductedDate: datetime | None = None
    allowLateSubmissions: bool = True
    lateGraceDays: int = 3
    hardCutoffDate: datetime | None = None
    targetBatches: list[str] = Field(default_factory=list)
    references: str | None = None
    additionalNotes: str | None = None
    clusterName: str | None = None
    rubric: list[RubricCriterion] | None = None
    createdAt: datetime
    updatedAt: datetime | None = None
