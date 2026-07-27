"""Authentication and Authorization dependencies for API routes.

RULE-AUTH03: JWT Cookie Present? → Validate JWT → Load User → Verify Role → Verify Profile → Allow Access.
RULE-AUTH07: RBAC enforcing role restrictions.
"""

from fastapi import Depends, Request, Response, status

from app.core.constants import ErrorCode
from app.middleware.error_handler import AppException
from app.repositories.user_repository import UserRepository
from app.utils.security import decode_jwt_token


async def get_current_user(
    request: Request, response: Response, user_repo: UserRepository = Depends()
) -> dict:
    """Extract, decode, and validate the JWT token from HTTP-only cookies or authorization header.

    RULE-AUTH01: JWT tokens stored in HTTP-only cookies.
    """
    token = request.cookies.get("access_token")

    # Fallback to Authorization header if cookies aren't present (e.g. testing)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise AppException(
            code=ErrorCode.UNAUTHORIZED,
            message="Authentication credentials missing",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    payload = decode_jwt_token(token)
    if not payload:
        response.delete_cookie(
            key="access_token",
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
        )
        raise AppException(
            code=ErrorCode.INVALID_TOKEN,
            message="Token is invalid or expired",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    email = payload.get("sub")
    if not email:
        response.delete_cookie(
            key="access_token",
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
        )
        raise AppException(
            code=ErrorCode.INVALID_TOKEN,
            message="Invalid token payload",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    user = await user_repo.find_by_email(email)
    if not user:
        response.delete_cookie(
            key="access_token",
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
        )
        raise AppException(
            code=ErrorCode.USER_NOT_FOUND,
            message="User not found",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    return user


async def get_active_user(user: dict = Depends(get_current_user)) -> dict:
    """Ensure that the authenticated user is verified (completed OTP verification).

    RULE-AUTH04: Verify email ownership before activation.
    """
    if not user.get("is_verified", False):
        raise AppException(
            code=ErrorCode.UNAUTHORIZED,
            message="Email address not verified",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return user


async def get_complete_profile_user(user: dict = Depends(get_active_user)) -> dict:
    """Ensure the user profile setup is complete.

    RULE-AUTH06: Redirect to profile setup if incomplete.
    """
    if not user.get("is_profile_complete", False):
        raise AppException(
            code=ErrorCode.PROFILE_INCOMPLETE,
            message="Academic profile registration incomplete",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    return user


class RoleChecker:
    """RBAC Dependency to validate that user roles align with route permissions.

    RULE-AUTH07: RBAC forces teacher vs student limits.
    """

    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: dict = Depends(get_active_user)) -> dict:
        if user["role"] not in self.allowed_roles:
            raise AppException(
                code=ErrorCode.FORBIDDEN,
                message="Resource access forbidden for this user role",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return user
