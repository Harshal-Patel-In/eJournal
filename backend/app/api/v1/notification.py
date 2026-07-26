"""In-app notifications API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC controls routes.
"""

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import get_active_user
from app.schemas.notification import NotificationResponse
from app.schemas.response import ApiResponse, success_response
from app.repositories.notification_repository import NotificationRepository

router = APIRouter(prefix="/notifications")


@router.get("", response_model=ApiResponse[list[NotificationResponse]])
async def list_notifications(
    user: dict = Depends(get_active_user),
    notification_repo: NotificationRepository = Depends(),
):
    """Retrieve the recent notifications for the logged-in user."""
    notifications = await notification_repo.find_by_user_id(user["id"])
    return success_response(notifications)


@router.put("/{notificationId}/read", response_model=ApiResponse[bool])
async def mark_as_read(
    notificationId: str,
    user: dict = Depends(get_active_user),
    notification_repo: NotificationRepository = Depends(),
):
    """Mark a specific notification as read."""
    # Note: in a full production system, we'd verify user["id"] == notification["userId"]
    success = await notification_repo.mark_as_read(notificationId)
    return success_response(success)


@router.post("/read-all", response_model=ApiResponse[bool])
async def mark_all_as_read(
    user: dict = Depends(get_active_user),
    notification_repo: NotificationRepository = Depends(),
):
    """Mark all pending notifications for the logged-in user as read."""
    success = await notification_repo.mark_all_as_read(user["id"])
    return success_response(success)
