"""In-app notifications and real-time WebSocket API router.

RULE-API01: Follow RESTful conventions.
RULE-AUTH07: RBAC controls routes.
"""

import logging
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status

from app.core.config import settings
from app.core.websocket_manager import websocket_manager
from app.dependencies.auth import get_active_user
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.notification import NotificationResponse
from app.schemas.response import ApiResponse, success_response
from app.utils.security import decode_jwt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications")


@router.websocket("/ws")
async def notification_websocket(
    websocket: WebSocket,
    user_repo: UserRepository = Depends(),
):
    """Persistent WebSocket connection for real-time user notification streaming."""
    # Origin verification to prevent Cross-Site WebSocket Hijacking (CSWSH) (SEC-08)
    origin = websocket.headers.get("origin")
    if origin:
        allowed_origins = set(settings.BACKEND_CORS_ORIGINS) | {
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "testserver",
        }
        if origin not in allowed_origins:
            logger.warning("WebSocket handshake rejected: Disallowed origin %s", origin)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Disallowed origin")
            return

    token = (
        websocket.query_params.get("token")
        or websocket.cookies.get("access_token")
    )

    if not token:
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        logger.warning("WebSocket connection rejected: Missing auth credentials.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    payload = decode_jwt_token(token)
    if not payload or not payload.get("sub"):
        logger.warning("WebSocket connection rejected: Invalid or expired token.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    email = payload["sub"]
    user = await user_repo.find_by_email(email)
    if not user or not user.get("isActive", True):
        logger.warning(f"WebSocket connection rejected: User not found or inactive for email {email}.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User inactive")
        return

    user_id = user["id"]

    try:
        await websocket_manager.connect(user_id, websocket)
        await websocket.send_json({"type": "CONNECTED", "userId": user_id})
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except (WebSocketDisconnect, RuntimeError):
        await websocket_manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.info(f"WebSocket closed for user {user_id}: {e}")
        await websocket_manager.disconnect(user_id, websocket)


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
    success = await notification_repo.mark_as_read(notificationId, user_id=user["id"])
    return success_response(success)


@router.post("/read-all", response_model=ApiResponse[bool])
async def mark_all_as_read(
    user: dict = Depends(get_active_user),
    notification_repo: NotificationRepository = Depends(),
):
    """Mark all pending notifications for the logged-in user as read."""
    success = await notification_repo.mark_all_as_read(user["id"])
    return success_response(success)
