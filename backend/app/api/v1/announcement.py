"""Campus Broadcast Announcements API router.

Supports Dual-Layer Real-Time Push (SSE + Redis Pub/Sub) with Persistent State (MongoDB + Redis Cache).
RULE-API02: Versioned endpoints under /api/v1/announcements.
RULE-AUTH07: Role-based access control.
RULE-SEC10: Audit logging on administrative broadcasts.
"""

import asyncio
import time
from datetime import datetime, timezone, timedelta
import json
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
import structlog

from app.core.config import settings
from app.core.constants import ErrorCode
from app.core.database import get_database
from app.core.redis import get_redis_client
from app.dependencies.auth import get_current_user, RoleChecker
from app.middleware.error_handler import AppException
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.announcement import (
    BroadcastAnnouncementCreateRequest,
    BroadcastAnnouncementResponse,
)
from app.schemas.response import ApiResponse, success_response

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/announcements", tags=["Announcements"])

ACTIVE_CACHE_KEY = "announcements:broadcast:active"
PUBSUB_CHANNEL = "broadcast_announcements"


def _doc_to_response(doc: dict, current_user_id: str | None = None) -> dict:
    """Format MongoDB announcement document to API response."""
    doc_id = str(doc.get("_id") or doc.get("id"))
    ack_list = doc.get("acknowledgedBy", [])
    is_ack = False
    if current_user_id:
        is_ack = any(str(item.get("userId")) == str(current_user_id) for item in ack_list)

    action_data = doc.get("action") or {
        "actionType": "none",
        "actionLabel": None,
        "actionUrl": None,
        "modalContent": None,
        "requiresAcknowledgment": False,
    }

    return {
        "id": doc_id,
        "title": doc.get("title", ""),
        "content": doc.get("content", ""),
        "category": doc.get("category", "general_info"),
        "priority": doc.get("priority", "normal"),
        "targetRoles": doc.get("targetRoles", ["all"]),
        "action": action_data,
        "isActive": doc.get("isActive", True),
        "startsAt": doc.get("startsAt", datetime.now(timezone.utc)),
        "expiresAt": doc.get("expiresAt", datetime.now(timezone.utc)),
        "acknowledgedCount": len(ack_list),
        "isAcknowledged": is_ack,
        "createdAt": doc.get("createdAt", datetime.now(timezone.utc)),
    }


@router.post("/broadcast", response_model=ApiResponse[dict])
async def create_broadcast_announcement(
    payload: BroadcastAnnouncementCreateRequest,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
):
    """Publish a campus-wide broadcast announcement with SSE push and database persistence."""
    db = get_database()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=payload.expiresInHours)

    announcement_id = ObjectId()
    doc = {
        "_id": announcement_id,
        "title": payload.title,
        "content": payload.content,
        "category": payload.category,
        "priority": payload.priority,
        "targetRoles": payload.targetRoles,
        "action": payload.action.model_dump(),
        "isActive": True,
        "startsAt": now,
        "expiresAt": expires_at,
        "acknowledgedBy": [],
        "createdBy": str(admin_user.get("id")),
        "createdAt": now,
        "updatedAt": now,
    }

    db.announcements.insert_one(doc)

    formatted = _doc_to_response(doc, current_user_id=str(admin_user.get("id")))

    # Invalidate and populate Redis cache
    redis = get_redis_client()
    if redis is not None:
        try:
            # Cache active notices
            await redis.delete(ACTIVE_CACHE_KEY)

            # Publish event over Redis Pub/Sub to wake up online SSE listeners
            pub_payload = json.dumps({
                "type": "NEW_ANNOUNCEMENT",
                "announcement": {
                    **formatted,
                    "startsAt": formatted["startsAt"].isoformat(),
                    "expiresAt": formatted["expiresAt"].isoformat(),
                    "createdAt": formatted["createdAt"].isoformat(),
                },
            })
            await redis.publish(PUBSUB_CHANNEL, pub_payload)
        except Exception as e:
            logger.warning("redis_announcement_broadcast_publish_failed", error=str(e))

    # Security Audit Log
    audit_repo = AuditLogRepository()
    ip_address = request.client.host if request.client else None
    await audit_repo.log_event(
        user_id=admin_user.get("id"),
        action="CAMPUS_ANNOUNCEMENT_BROADCAST",
        entity="announcements",
        entity_id=str(announcement_id),
        ip_address=ip_address,
    )

    return success_response(formatted)


@router.get("/active", response_model=ApiResponse[list[dict]])
async def get_active_announcements(
    current_user: dict | None = Depends(get_current_user),
):
    """Fetch all active campus announcements. Serves offline/bootstrapping users via Redis cache."""
    now = datetime.now(timezone.utc)
    current_user_id = str(current_user["id"]) if current_user else None
    current_role = current_user.get("role", "all") if current_user else "all"

    redis = get_redis_client()
    cached_docs = None

    if redis is not None:
        try:
            raw_cached = await redis.get(ACTIVE_CACHE_KEY)
            if raw_cached:
                cached_docs = json.loads(raw_cached)
        except Exception as e:
            logger.debug("redis_active_announcements_cache_miss", error=str(e))

    if cached_docs is None:
        db = get_database()
        cursor = db.announcements.find({
            "isActive": True,
            "expiresAt": {"$gt": now},
        }).sort("createdAt", -1)
        raw_list = list(cursor)

        # Serialize for cache
        serializable = []
        for d in raw_list:
            resp = _doc_to_response(d)
            serializable.append({
                **resp,
                "startsAt": resp["startsAt"].isoformat(),
                "expiresAt": resp["expiresAt"].isoformat(),
                "createdAt": resp["createdAt"].isoformat(),
            })

        if redis is not None:
            try:
                await redis.setex(ACTIVE_CACHE_KEY, 60, json.dumps(serializable))
            except Exception:
                pass
        cached_docs = serializable

    # Filter by user role and evaluate user acknowledgment
    filtered = []
    for item in cached_docs:
        target_roles = item.get("targetRoles", ["all"])
        if "all" in target_roles or current_role in target_roles:
            is_ack = False
            if current_user_id:
                db = get_database()
                is_ack_match = db.announcements.find_one({
                    "_id": ObjectId(item["id"]),
                    "acknowledgedBy.userId": current_user_id,
                })
                is_ack = bool(is_ack_match)
            filtered.append({**item, "isAcknowledged": is_ack})

    return success_response(filtered)


@router.get("/stream")
async def stream_announcements(request: Request):
    """Server-Sent Events (SSE) push stream with graceful reload/shutdown awareness."""
    async def event_generator():
        redis = get_redis_client()
        pubsub = None
        if redis is not None:
            try:
                pubsub = redis.pubsub()
                await pubsub.subscribe(PUBSUB_CHANNEL)
            except Exception as e:
                logger.warning("sse_pubsub_subscribe_failed", error=str(e))
                pubsub = None

        shutdown_event = getattr(request.app.state, "shutdown_event", None)

        try:
            # Immediate initial connected event
            yield f"event: connected\ndata: {json.dumps({'status': 'listening'})}\n\n"

            last_ping = time.time()
            ping_interval = 25.0

            while True:
                # 1. Shutdown guard: exit immediately if server is reloading or stopping
                if shutdown_event and shutdown_event.is_set():
                    logger.debug("sse_stream_closing_on_shutdown")
                    break

                # 2. Client disconnect guard
                if await request.is_disconnected():
                    break

                # 3. Message check
                if pubsub:
                    try:
                        # Non-blocking poll with 0.5s timeout so shutdown_event is evaluated every 500ms
                        msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
                        if msg and msg.get("data"):
                            raw_data = msg["data"]
                            if isinstance(raw_data, bytes):
                                raw_data = raw_data.decode("utf-8")
                            yield f"event: announcement\ndata: {raw_data}\n\n"
                            last_ping = time.time()
                            continue
                    except Exception:
                        pass
                else:
                    await asyncio.sleep(0.5)

                # 4. Periodic keepalive ping every 25 seconds
                now = time.time()
                if now - last_ping >= ping_interval:
                    yield ": ping\n\n"
                    last_ping = now
        finally:
            if pubsub:
                try:
                    await pubsub.unsubscribe(PUBSUB_CHANNEL)
                    await pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{id}/acknowledge", response_model=ApiResponse[dict])
async def acknowledge_announcement(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    """Record user acknowledgment of an action-gated campus announcement."""
    db = get_database()
    now = datetime.now(timezone.utc)
    user_id = str(current_user["id"])

    res = db.announcements.update_one(
        {
            "_id": ObjectId(id),
            "acknowledgedBy.userId": {"$ne": user_id},
        },
        {
            "$push": {
                "acknowledgedBy": {
                    "userId": user_id,
                    "timestamp": now,
                    "name": current_user.get("name", "User"),
                    "email": current_user.get("email", ""),
                }
            }
        },
    )

    return success_response({
        "announcementId": id,
        "acknowledged": True,
        "timestamp": now.isoformat(),
    })


@router.get("/admin/list", response_model=ApiResponse[list[dict]])
async def list_admin_announcements(
    admin_user: dict = Depends(RoleChecker(["admin"])),
):
    """Retrieve full campus broadcast registry with compliance and acknowledgment counts."""
    db = get_database()
    cursor = db.announcements.find().sort("createdAt", -1).limit(50)
    docs = list(cursor)
    results = [_doc_to_response(d) for d in docs]
    return success_response(results)


@router.delete("/{id}", response_model=ApiResponse[dict])
async def delete_announcement(
    id: str,
    request: Request,
    admin_user: dict = Depends(RoleChecker(["admin"])),
):
    """Deactivate and delete a broadcast announcement."""
    db = get_database()
    db.announcements.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"isActive": False, "deletedAt": datetime.now(timezone.utc)}},
    )

    redis = get_redis_client()
    if redis is not None:
        try:
            await redis.delete(ACTIVE_CACHE_KEY)
            await redis.publish(
                PUBSUB_CHANNEL,
                json.dumps({"type": "DELETE_ANNOUNCEMENT", "announcementId": id}),
            )
        except Exception:
            pass

    audit_repo = AuditLogRepository()
    ip_address = request.client.host if request.client else None
    await audit_repo.log_event(
        user_id=admin_user.get("id"),
        action="CAMPUS_ANNOUNCEMENT_DELETED",
        entity="announcements",
        entity_id=id,
        ip_address=ip_address,
    )

    return success_response({"id": id, "deleted": True})

