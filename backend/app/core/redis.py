"""Redis client utility.

RULE-INF06: Redis serves as cache, session cache, rate limiter.
"""

import asyncio
import structlog
import redis.asyncio as aioredis

from app.core.config import settings

logger = structlog.get_logger(__name__)

_redis_client: aioredis.Redis | None = None


def create_redis_client() -> aioredis.Redis:
    """Instantiate a resilient Redis client pool with strict timeouts and retries."""
    return aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        socket_timeout=5.0,
        socket_connect_timeout=5.0,
        retry_on_timeout=True,
        health_check_interval=30,
    )


async def connect_to_redis() -> None:
    """Create Redis connection with exponential retry resilience."""
    global _redis_client

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            client = create_redis_client()
            await client.ping()
            _redis_client = client
            logger.info("redis_pool_created", attempt=attempt)
            return
        except Exception as e:
            logger.warning("redis_connection_attempt_failed", attempt=attempt, max_attempts=max_attempts, error=str(e))
            if attempt == max_attempts:
                logger.warning("redis_offline_continuing_in_fallback_mode", error=str(e))
                # Set a lazily-connectable pool so operations can auto-recover when Redis responds
                _redis_client = create_redis_client()
                return
            await asyncio.sleep(attempt * 0.5)


async def close_redis_connection() -> None:
    """Close Redis connection on shutdown."""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception:
            pass
        _redis_client = None


def get_redis() -> aioredis.Redis:
    """Get the shared Redis client instance, lazily creating if not present."""
    global _redis_client
    if _redis_client is None:
        _redis_client = create_redis_client()
    return _redis_client


def get_redis_client() -> aioredis.Redis | None:
    """Get the shared Redis client instance or lazily instantiate."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = create_redis_client()
        except Exception:
            return None
    return _redis_client
