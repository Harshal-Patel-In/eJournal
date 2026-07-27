"""Global exception handlers.

RULE-ERR01: Every API error returns structured JSON with success: false.
RULE-ERR02: Internal errors MUST NOT leak stack traces or DB details.
"""

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from app.core.constants import ErrorCode
from app.schemas.response import error_response

logger = structlog.get_logger(__name__)


class AppException(Exception):
    """Base application exception with structured error code."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: object = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the app."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(
            "app_exception",
            code=exc.code,
            message=exc.message,
            path=request.url.path,
        )
        response = JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message, exc.details),
        )
        
        # Clear JWT cookie if authentication fails (breaks redirect loops on path '/')
        if exc.code in [ErrorCode.UNAUTHORIZED, ErrorCode.INVALID_TOKEN, ErrorCode.USER_NOT_FOUND]:
            response.delete_cookie(
                key="access_token",
                httponly=True,
                samesite="lax",
                secure=False,
                path="/",
            )
            
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        logger.warning(
            "validation_error",
            path=request.url.path,
            errors=str(exc.errors()),
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=error_response(
                ErrorCode.VALIDATION_ERROR,
                "Request validation failed",
                exc.errors(),
            ),
        )

    @app.exception_handler(PyMongoError)
    async def pymongo_exception_handler(request: Request, exc: PyMongoError):
        # RULE-ERR02: Never leak DB details to client
        logger.error(
            "database_error",
            path=request.url.path,
            error=str(exc),
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response(
                ErrorCode.DATABASE_ERROR,
                "A database error occurred",
            ),
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        # RULE-ERR02: Never leak stack traces
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            error_type=type(exc).__name__,
            error=str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_response(
                ErrorCode.INTERNAL_ERROR,
                "An unexpected error occurred",
            ),
        )
