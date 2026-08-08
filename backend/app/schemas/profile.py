"""Pydantic schemas for academic profile modifications.

Enforces rules regarding required fields on student vs teacher roles.
"""

from pydantic import BaseModel, Field


class ProfileUpdateRequest(BaseModel):
    """Request payload to set or update profile academic metadata.

    Fields are optional on update schema but validated for role-specific
    completeness inside the profile setup service layer.
    """

    name: str | None = Field(default=None, min_length=2)
    department: str | None = Field(default=None, min_length=2)
    semester: str | None = Field(default=None)
    division: str | None = Field(default=None)
    batch: str | None = Field(default=None)
    enrollmentNumber: str | None = Field(default=None)
    facultyId: str | None = Field(default=None)
    designation: str | None = Field(default=None)
    college: str | None = Field(default=None, min_length=2)
    university: str | None = Field(default=None, min_length=2)
    profilePhoto: str | None = Field(default=None)
