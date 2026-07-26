"""Standard API response envelope schemas.

RULE-API03: Every response uses a consistent envelope format.
Success: { "success": true, "data": { ... } }
Error: { "success": false, "error": { "code": "...", "message": "...", "details": null } }
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error information."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    details: Any = Field(default=None, description="Additional error context")


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response envelope."""

    success: bool = Field(..., description="Whether the request succeeded")
    data: T | None = Field(default=None, description="Response payload")
    error: ErrorDetail | None = Field(default=None, description="Error details if failed")


def success_response(data: Any = None) -> dict:
    """Create a success response envelope."""
    return {"success": True, "data": data, "error": None}


def error_response(code: str, message: str, details: Any = None) -> dict:
    """Create an error response envelope."""
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "details": details},
    }
