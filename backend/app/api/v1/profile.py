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


@router.get("", response_model=ApiResponse[UserMeResponse])
async def get_profile(user: dict = Depends(get_active_user)):
    """Fetch current user's profile and account registration details."""
    return success_response(user)


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
    
    # Generate new token with updated is_profile_complete status
    access_token = create_jwt_token(
        data={
            "sub": updated_user["email"],
            "role": updated_user["role"],
            "is_profile_complete": updated_user["is_profile_complete"]
        }
    )
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=30 * 60,
        samesite="lax",
        secure=settings.cookie_secure,
    )
    
    return success_response(updated_user)
