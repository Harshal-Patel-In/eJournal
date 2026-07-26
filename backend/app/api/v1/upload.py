"""Local file upload management API router.

Saves uploaded image attachments locally to the uvicorn workspace and
returns relative URLs.
"""

import os
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.constants import ErrorCode
from app.dependencies.auth import get_active_user
from app.middleware.error_handler import AppException
from app.schemas.response import ApiResponse, success_response

router = APIRouter(prefix="/uploads")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/images", response_model=ApiResponse[dict])
async def upload_image(
    file: UploadFile = File(...),
    user: dict = Depends(get_active_user),
):
    """Accept multipart image files, validate type/size, and upload to Cloudinary (or fallback locally)."""
    if not file.filename:
        raise AppException(
            code=ErrorCode.VALIDATION_ERROR,
            message="No filename provided in upload payload",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise AppException(
            code=ErrorCode.VALIDATION_ERROR,
            message=f"File extension {ext} not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # Read and check file size
    try:
        content = await file.read()
    except Exception as e:
        raise AppException(
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to read uploaded file stream",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if len(content) > MAX_FILE_SIZE:
        raise AppException(
            code=ErrorCode.VALIDATION_ERROR,
            message="File size exceeds maximum size limit of 5MB",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    # 1. Cloudinary Upload Integration (Preferred if credentials are provided)
    from app.core.config import settings

    if (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        try:
            upload_result = cloudinary.uploader.upload(
                content,
                folder="ejournal_attachments",
                resource_type="image",
            )
            secure_url = upload_result.get("secure_url")
            return success_response({"url": secure_url})
        except Exception as e:
            raise AppException(
                code=ErrorCode.UPLOAD_FAILED,
                message=f"Cloudinary upload failed: {str(e)}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # 2. Local File Storage Fallback
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # Write unique file to disk
    unique_filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, unique_filename)

    try:
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise AppException(
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to write upload to server disk",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Generate relative URL endpoint (Nginx/Proxy serves /uploads)
    relative_url = f"/uploads/{unique_filename}"
    return success_response({"url": relative_url})

