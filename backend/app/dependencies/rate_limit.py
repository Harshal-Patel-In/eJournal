"""Rate limiting dependency for brute-force and abuse protection (SEC-05).

RULE-INF06: Redis serves as cache, session cache, rate limiter.
Gracefully falls back to thread-safe in-memory sliding window when Redis is offline.
"""

import time
import structlog
from collections import defaultdict
from fastapi import Request, status

from app.core.constants import ErrorCode
from app.core.redis import get_redis
from app.middleware.error_handler import AppException

logger = structlog.get_logger(__name__)

# In-memory sliding window fallback for offline/development environments
_in_memory_buckets: dict[str, list[float]] = defaultdict(list)


class RateLimiter:
    """FastAPI dependency that enforces request rate limits per client IP."""

    def __init__(self, max_requests: int, window_seconds: int, action: str = "default"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.action = action

    async def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        key = f"rate_limit:{self.action}:{client_ip}"

        # 1. Try Redis token bucket / sliding counter
        try:
            redis = get_redis()
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, self.window_seconds)
            results = await pipe.execute()
            current_count = results[0]

            if current_count > self.max_requests:
                logger.warning(
                    "rate_limit_exceeded_redis",
                    action=self.action,
                    ip=client_ip,
                    count=current_count,
                    max=self.max_requests,
                )
                raise AppException(
                    code=ErrorCode.TOO_MANY_REQUESTS,
                    message=f"Too many requests for {self.action}. Please try again later.",
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            return
        except AppException:
            raise
        except Exception:
            # Redis is offline or not configured -> use in-memory sliding window fallback
            pass

        # 2. In-memory sliding window fallback
        now = time.time()
        cutoff = now - self.window_seconds
        timestamps = _in_memory_buckets[key]

        # Prune old timestamps
        _in_memory_buckets[key] = [t for t in timestamps if t > cutoff]

        if len(_in_memory_buckets[key]) >= self.max_requests:
            logger.warning(
                "rate_limit_exceeded_in_memory",
                action=self.action,
                ip=client_ip,
                count=len(_in_memory_buckets[key]),
                max=self.max_requests,
            )
            raise AppException(
                code=ErrorCode.TOO_MANY_REQUESTS,
                message=f"Too many requests for {self.action}. Please try again later.",
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        _in_memory_buckets[key].append(now)
