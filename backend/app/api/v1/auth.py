"""Authentication and Account Registration API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH01: Store JWT tokens in HTTP-only cookies.
"""

from fastapi import APIRouter, Depends, Request, Response, status

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.rate_limit import RateLimiter
from app.schemas.auth import (
    UserLoginRequest,
    UserRegisterRequest,
    UserResendOTPRequest,
    UserVerifyRequest,
)
from app.schemas.response import ApiResponse, success_response
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth")


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[dict],
    dependencies=[Depends(RateLimiter(max_requests=10, window_seconds=60, action="register"))],
)
async def register(
    request: Request,
    payload: UserRegisterRequest,
    auth_service: AuthService = Depends(),
):
    """Register a new user account. Dispatches verification code (OTP) via mail."""
    ip_address = request.client.host if request.client else None
    result = await auth_service.register(payload, ip_address=ip_address)
    return success_response(result)


@router.post(
    "/verify-otp",
    response_model=ApiResponse[dict],
    dependencies=[Depends(RateLimiter(max_requests=15, window_seconds=60, action="verify_otp"))],
)
async def verify_otp(
    request: Request,
    response: Response,
    payload: UserVerifyRequest,
    auth_service: AuthService = Depends(),
):
    """Validate OTP code and activate account.

    On success, sets HTTP-only secure cookie containing JWT.
    """
    ip_address = request.client.host if request.client else None
    access_token = await auth_service.verify_otp(
        payload.email, payload.otp, ip_address=ip_address
    )

    # Set cookie (RULE-AUTH01, SEC-06)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=30 * 60,  # 30 mins
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )

    return success_response({"access_token": access_token, "token_type": "bearer"})


@router.post(
    "/resend-otp",
    response_model=ApiResponse[str],
    dependencies=[Depends(RateLimiter(max_requests=5, window_seconds=60, action="resend_otp"))],
)
async def resend_otp(
    payload: UserResendOTPRequest, auth_service: AuthService = Depends()
):
    """Regenerate and resend verification code (OTP) to user's email."""
    await auth_service.resend_otp(payload.email)
    return success_response("OTP code resent successfully")


@router.post(
    "/login",
    response_model=ApiResponse[dict],
    dependencies=[Depends(RateLimiter(max_requests=20, window_seconds=60, action="login"))],
)
async def login(
    request: Request,
    response: Response,
    payload: UserLoginRequest,
    auth_service: AuthService = Depends(),
):
    """Authenticate credentials, verify account status, set JWT cookie."""
    ip_address = request.client.host if request.client else None
    access_token, user = await auth_service.login(
        payload.email, payload.password, ip_address=ip_address
    )

    # Set cookie (RULE-AUTH01, SEC-06)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=30 * 60,  # 30 mins
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )

    user_meta = {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "is_verified": user.get("is_verified", False),
        "is_profile_complete": user.get("is_profile_complete", False),
    }
    return success_response({"user": user_meta, "access_token": access_token})


@router.post("/logout", response_model=ApiResponse[str])
async def logout(response: Response):
    """Clear access token cookie and sign out current user session."""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return success_response("Logged out successfully")
