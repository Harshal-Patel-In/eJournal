"""User Profile management API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH06: Redirect to profile setup if incomplete.
"""

from fastapi import APIRouter, Depends, Response

from app.core.config import settings
from app.dependencies.auth import get_active_user
from app.schemas.auth import UserMeResponse
from app.schemas.profile import ProfileUpdateRequest
from app.schemas.response import ApiResponse, success_response
from app.services.auth_service import AuthService
from app.utils.security import create_jwt_token

router = APIRouter(prefix="/profile")


@router.get("/check-enrollment", response_model=ApiResponse[dict])
async def check_enrollment_availability(
    enrollmentNumber: str,
    user: dict = Depends(get_active_user),
    auth_service: AuthService = Depends(),
):
    """Check whether an enrollment number is available or claimed by another student."""
    is_available = await auth_service.check_enrollment_available(user["id"], enrollmentNumber)
    clean_enr = enrollmentNumber.strip().upper()
    return success_response(
        {
            "enrollmentNumber": clean_enr,
            "isAvailable": is_available,
            "message": "Available" if is_available else "This enrollment number is already registered by another student.",
        }
    )


@router.get("", response_model=ApiResponse[UserMeResponse])
async def get_profile(user: dict = Depends(get_active_user)):
    """Fetch current user's profile and account registration details."""
    is_admin = bool(user.get("is_admin", False) or user.get("isAdmin", False) or user["role"] == "admin")
    access_token = create_jwt_token(
        data={
            "sub": user["email"],
            "role": user["role"],
            "is_admin": is_admin,
            "is_profile_complete": user.get("is_profile_complete", False),
        }
    )
    user_data = dict(user)
    user_data["access_token"] = access_token
    user_data["is_admin"] = is_admin
    user_data["isAdmin"] = is_admin
    return success_response(user_data)


@router.put("", response_model=ApiResponse[UserMeResponse])
async def update_profile(
    response: Response,
    payload: ProfileUpdateRequest,
    user: dict = Depends(get_active_user),
    auth_service: AuthService = Depends(),
):
    """Set or update user's profile academic parameters.

    If all required fields are provided, locks profile and allows dashboard/editor access.
    """
    updated_user = await auth_service.update_profile(user, payload)
    is_admin = bool(updated_user.get("is_admin", False) or updated_user.get("isAdmin", False) or updated_user["role"] == "admin")

    # Generate new token with updated is_profile_complete status and is_admin
    access_token = create_jwt_token(
        data={
            "sub": updated_user["email"],
            "role": updated_user["role"],
            "is_admin": is_admin,
            "is_profile_complete": updated_user["is_profile_complete"],
        }
    )

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=30 * 60,
        samesite="none" if settings.is_production else "lax",
        secure=True if settings.is_production else settings.cookie_secure,
        path="/",
    )
    user_dict = dict(updated_user)
    user_dict["is_admin"] = is_admin
    user_dict["isAdmin"] = is_admin
    user_dict["access_token"] = access_token
    return success_response(user_dict)
