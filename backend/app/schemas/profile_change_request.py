"""Pydantic schemas for student/faculty profile correction requests.

RULE-BE03: All request and response models MUST be defined as Pydantic schemas.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class RequestedFieldChange(BaseModel):
    """Specification of a single field modification."""
    field: str = Field(..., description="Field name (name, enrollmentNumber, department, college)")
    currentValue: str = Field(..., description="Current value in the database")
    requestedValue: str = Field(..., description="Requested new value")


class ProfileChangeRequestCreate(BaseModel):
    """Payload submitted by a student to request a record correction."""
    field: str = Field(..., description="Field to modify: name, enrollmentNumber, department, college")
    requestedValue: str = Field(..., min_length=1, description="Desired corrected value")
    reason: str = Field(..., min_length=5, description="Institutional justification for the correction")


class ProfileChangeRequestResponse(BaseModel):
    """Schema returned for a profile change request."""
    id: str
    userId: str
    userRole: str
    studentName: str
    currentEnrollmentNumber: str
    department: str
    college: str
    field: str
    currentValue: str
    requestedValue: str
    reason: str
    status: str
    rejectionReason: str | None = None
    adminNotes: str | None = None
    bumpCount: int = 0
    lastBumpedAt: datetime | None = None
    createdAt: datetime
    updatedAt: datetime
    reviewedBy: str | None = None
    reviewedAt: datetime | None = None


class ProfileChangeRequestReject(BaseModel):
    """Payload submitted by an administrator to reject a request."""
    rejectionReason: str = Field(..., min_length=5, description="Administrative reason for rejection")


class AdminProfileUpdateRequest(BaseModel):
    """Direct profile modification payload submitted by an administrator."""
    name: str | None = Field(None, min_length=2)
    enrollmentNumber: str | None = Field(None, min_length=2)
    facultyId: str | None = Field(None)
    department: str | None = Field(None, min_length=2)
    semester: str | None = Field(None)
    division: str | None = Field(None)
    batch: str | None = Field(None)
    college: str | None = Field(None, min_length=2)
    designation: str | None = Field(None)
    adminNotes: str | None = Field(None, description="Optional administrative override justification")

