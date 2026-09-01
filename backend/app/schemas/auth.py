"""Pydantic schemas for authentication and registration requests/responses."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """Request payload for registering a new user."""

    email: EmailStr = Field(..., description="Institutional email address")
    password: str = Field(..., min_length=8, description="User password (min 8 chars)")
    role: Literal["student", "teacher"] = Field(..., description="Role in the institution")


class UserVerifyRequest(BaseModel):
    """Request payload for verifying account with OTP."""

    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class UserResendOTPRequest(BaseModel):
    """Request payload for resending OTP verification code."""

    email: EmailStr


class UserLoginRequest(BaseModel):
    """Request payload for user logging in."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Bearer token response schema."""

    access_token: str
    token_type: str = "bearer"


class UserProfileSchema(BaseModel):
    """Embedded profile details within the user response."""

    name: str | None = None
    department: str | None = None
    semester: str | None = None
    division: str | None = None
    batch: str | None = None
    enrollmentNumber: str | None = None
    facultyId: str | None = None
    designation: str | None = None
    college: str | None = None
    university: str | None = None
    profilePhoto: str | None = None


class UserMeResponse(BaseModel):
    """Active user detailed response schema."""

    id: str
    email: EmailStr
    role: str
    is_verified: bool
    is_profile_complete: bool
    profile: UserProfileSchema
    createdAt: datetime
    updatedAt: datetime
