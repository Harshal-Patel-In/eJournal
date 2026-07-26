"""Health check endpoint.

Returns service status including MongoDB and Redis connectivity.
"""

import structlog
from fastapi import APIRouter

from app.core.database import get_database
from app.core.redis import get_redis
from app.schemas.response import success_response

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/health")
async def health_check():
    """Check service health including database and cache connectivity."""
    health = {
        "status": "healthy",
        "services": {
            "mongodb": "unknown",
            "redis": "unknown",
        },
    }

    # Check MongoDB
    try:
        db = get_database()
        db.command("ping")
        health["services"]["mongodb"] = "connected"
    except Exception as e:
        health["status"] = "degraded"
        health["services"]["mongodb"] = "disconnected"
        logger.warning("health_check_mongodb_failed", error=str(e))

    # Check Redis
    try:
        redis = get_redis()
        await redis.ping()
        health["services"]["redis"] = "connected"
    except Exception as e:
        health["status"] = "degraded"
        health["services"]["redis"] = "disconnected"
        logger.warning("health_check_redis_failed", error=str(e))

    return success_response(health)
