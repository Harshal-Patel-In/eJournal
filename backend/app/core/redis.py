"""Redis client utility.

RULE-INF06: Redis serves as cache, session cache, rate limiter.
"""

import structlog
import redis.asyncio as aioredis

from app.core.config import settings

logger = structlog.get_logger(__name__)

_redis_client: aioredis.Redis | None = None


async def connect_to_redis() -> None:
    """Create Redis connection."""
    global _redis_client

    _redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )

    # Verify connection
    try:
        await _redis_client.ping()
    except Exception as e:
        logger.error("redis_connection_failed", error=str(e))
        raise

    logger.info("redis_pool_created")


async def close_redis_connection() -> None:
    """Close Redis connection on shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


def get_redis() -> aioredis.Redis:
    """Get the shared Redis client instance."""
    if _redis_client is None:
        raise RuntimeError("Redis is not connected. Call connect_to_redis() first.")
    return _redis_client
