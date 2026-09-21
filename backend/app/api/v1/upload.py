"""File upload management API router and Recycle Bin lifecycle.

Saves image attachments to cloud storage (or local fallback), tracks asset ownership,
and manages 3-day recycle bin retention and permanent destruction.
"""

import logging
import os
import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.constants import ErrorCode
from app.dependencies.auth import get_active_user
from app.middleware.error_handler import AppException
from app.repositories.asset_repository import AssetRepository
from app.schemas.response import ApiResponse, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


class TrashImageRequest(BaseModel):
    url: str


def _destroy_cloud_or_local_file(asset: dict) -> None:
    """Safely destroy an asset from cloud storage or local disk."""
    from app.core.config import settings

    public_id = asset.get("publicId")
    if (
        public_id
        and settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        try:
            import cloudinary
            import cloudinary.uploader

            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                secure=True,
            )
            cloudinary.uploader.destroy(public_id)
            logger.info("Asset successfully destroyed from cloud storage: %s", public_id)
        except Exception as e:
            logger.error("Failed to destroy asset from cloud storage: %s", str(e))

    url = asset.get("url", "")
    if url.startswith("/uploads/"):
        # Enforce strict path sanitization and directory confinement (SEC-01)
        clean_url = url.split("?")[0].split("#")[0]
        local_filename = os.path.basename(clean_url.replace("/uploads/", ""))
        if local_filename and not local_filename.startswith("."):
            from pathlib import Path
            base_dir = Path("uploads").resolve()
            target_path = (base_dir / local_filename).resolve()

            # Ensure the target path is strictly confined inside the uploads directory
            if base_dir in target_path.parents and target_path.is_file():
                try:
                    target_path.unlink()
                    logger.info("Local upload file removed: %s", target_path)
                except Exception as e:
                    logger.error("Failed to delete local upload file %s: %s", target_path, str(e))



@router.post("/images", response_model=ApiResponse[dict])
async def upload_image(
    file: UploadFile = File(...),
    user: dict = Depends(get_active_user),
):
    """Accept multipart image files, validate type/size, upload to storage, and register asset."""
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
    except Exception:
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

    asset_repo = AssetRepository()

    # 1. Cloud Storage Integration (Preferred if credentials are provided)
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
            public_id = upload_result.get("public_id")

            asset = await asset_repo.create_asset(
                user_id=user["id"],
                url=secure_url,
                public_id=public_id,
                filename=file.filename,
                size=len(content),
                content_type=file.content_type or "image",
            )

            return success_response({
                "url": secure_url,
                "assetId": asset["id"],
                "publicId": public_id,
            })
        except Exception as e:
            logger.error("Cloud storage upload failed: %s", str(e))
            # Sanitize error message to prevent leaking vendor information
            raise AppException(
                code=ErrorCode.UPLOAD_FAILED,
                message="Image upload failed. Please try again.",
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
    except Exception:
        raise AppException(
            code=ErrorCode.INTERNAL_ERROR,
            message="Failed to write upload to server disk",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Generate relative URL endpoint (Nginx/Proxy serves /uploads)
    relative_url = f"/uploads/{unique_filename}"
    asset = await asset_repo.create_asset(
        user_id=user["id"],
        url=relative_url,
        public_id=None,
        filename=file.filename,
        size=len(content),
        content_type=file.content_type or "image",
    )

    return success_response({
        "url": relative_url,
        "assetId": asset["id"],
        "publicId": None,
    })


@router.post("/trash", response_model=ApiResponse[dict])
async def move_to_trash(
    req: TrashImageRequest,
    user: dict = Depends(get_active_user),
):
    """Move an image to the user's recycle bin (retained for 3 days)."""
    if not req.url:
        raise AppException(
            code=ErrorCode.VALIDATION_ERROR,
            message="Image URL is required to move to recycle bin",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    asset_repo = AssetRepository()
    asset = await asset_repo.move_to_trash(user_id=user["id"], url=req.url)
    return success_response(asset or {"message": "Image moved to recycle bin"})


@router.get("/trash", response_model=ApiResponse[list[dict]])
async def get_trash_items(
    user: dict = Depends(get_active_user),
):
    """Retrieve all trashed images for the user within the 3-day retention period.

    Also runs an automatic sweep for any expired items to purge cloud/local assets.
    """
    asset_repo = AssetRepository()

    # Automatic sweep of expired items across system
    try:
        expired_assets = await asset_repo.get_expired_trash()
        for expired in expired_assets:
            _destroy_cloud_or_local_file(expired)
            await asset_repo.delete_permanently(expired["userId"], expired["id"])
    except Exception as e:
        logger.error("Error during expired trash sweep: %s", str(e))

    trash_items = await asset_repo.get_trash(user["id"])
    return success_response(trash_items)


@router.post("/trash/{asset_id}/restore", response_model=ApiResponse[dict])
async def restore_from_trash(
    asset_id: str,
    user: dict = Depends(get_active_user),
):
    """Restore an image from the recycle bin back to active state."""
    asset_repo = AssetRepository()
    asset = await asset_repo.restore_from_trash(user_id=user["id"], asset_id=asset_id)
    if not asset:
        raise AppException(
            code=ErrorCode.NOT_FOUND,
            message="Image not found in recycle bin or retention period has expired",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    return success_response(asset)


@router.delete("/trash/{asset_id}/permanent", response_model=ApiResponse[dict])
async def delete_permanently(
    asset_id: str,
    user: dict = Depends(get_active_user),
):
    """Permanently delete an image from cloud/disk storage and database."""
    asset_repo = AssetRepository()
    asset = await asset_repo.delete_permanently(user_id=user["id"], asset_id=asset_id)
    if not asset:
        raise AppException(
            code=ErrorCode.NOT_FOUND,
            message="Image not found in recycle bin",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Immediately destroy cloud asset / local file
    _destroy_cloud_or_local_file(asset)

    return success_response({"message": "Image permanently deleted"})
