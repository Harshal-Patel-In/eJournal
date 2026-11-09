"""eJournal Backend - FastAPI Application Entry Point."""

import asyncio
import gc
import time
from contextlib import asynccontextmanager

# Configure robust DNS nameservers fallback for MongoDB Atlas SRV resolution
try:
    import dns.resolver
    resolver = dns.resolver.Resolver()
    resolver.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
    dns.resolver.default_resolver = resolver
except Exception:
    pass

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import connect_to_mongodb, close_mongodb_connection
from app.core.redis import connect_to_redis, close_redis_connection
from app.core.logging import setup_logging
from app.middleware.error_handler import register_exception_handlers

logger = structlog.get_logger(__name__)
APP_START_TIME = time.time()

# Proactively guard Uvicorn against reload/shutdown deadlocks on Windows (WatchFiles reload hang)
# When --timeout-graceful-shutdown is None (the default in uvicorn CLI), long-lived WebSockets
# or SSE streams cause uvicorn to hang indefinitely waiting for connections to close.
try:
    import uvicorn.server
    import uvicorn.config

    # Set default graceful shutdown timeout to 1s on any existing config instance
    for _obj in gc.get_objects():
        if isinstance(_obj, uvicorn.Config) and _obj.timeout_graceful_shutdown is None:
            _obj.timeout_graceful_shutdown = 1

    _orig_uvicorn_shutdown = uvicorn.server.Server.shutdown

    async def _safe_uvicorn_shutdown(self, sockets=None):
        if getattr(self.config, "timeout_graceful_shutdown", None) is None:
            self.config.timeout_graceful_shutdown = 1

        # Proactively close all WebSockets before uvicorn enters task wait loop
        try:
            from app.core.websocket_manager import websocket_manager
            await websocket_manager.close_all()
        except Exception:
            pass

        # Discard or close lingering connections so reload continues without freezing
        try:
            if hasattr(self, "server_state") and hasattr(self.server_state, "connections"):
                for conn in list(self.server_state.connections):
                    try:
                        conn.shutdown()
                    except Exception:
                        pass
        except Exception:
            pass

        return await _orig_uvicorn_shutdown(self, sockets)

    uvicorn.server.Server.shutdown = _safe_uvicorn_shutdown
except Exception:
    pass



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    setup_logging()
    logger.info("application_starting", environment=settings.ENVIRONMENT)

    # Connect to MongoDB Atlas
    await connect_to_mongodb()
    logger.info("mongodb_connected", database=settings.MONGODB_DATABASE)

    # Initialize collections and indexes asynchronously in background (RULE-DB03)
    # Reuses existing database pool and does not block critical server boot path
    async def _verify_indexes_background():
        try:
            from app.core.database import get_database
            from scripts.create_indexes import create_indexes
            db = get_database()
            await asyncio.to_thread(create_indexes, db=db)
            logger.info("mongodb_indexes_verified")
        except Exception as e:
            logger.error("mongodb_indexes_verification_failed", error=str(e))

    asyncio.create_task(_verify_indexes_background())

    # Ensure default Super Administrator exists (documents/admin.md)
    try:
        from datetime import datetime, timezone
        import os
        from app.core.database import get_database
        from app.utils.security import hash_password

        db = get_database()
        admin_email = os.getenv("ADMIN_EMAIL", "admin@ejournal.com").lower().strip()
        existing_admin = db.users.find_one({"email": admin_email})
        if not existing_admin:
            initial_password = os.getenv("ADMIN_INITIAL_PASSWORD", "Admin@123456")
            db.users.insert_one(
                {
                    "email": admin_email,
                    "password_hash": hash_password(initial_password),
                    "role": "admin",
                    "is_verified": True,
                    "is_profile_complete": True,
                    "status": "active",
                    "must_change_password": True,
                    "profile": {
                        "name": "Super Administrator",
                        "department": "Administration",
                        "designation": "System Administrator",
                        "college": "Engineering & Technology Institute",
                    },
                    "createdAt": datetime.now(timezone.utc),
                    "updatedAt": datetime.now(timezone.utc),
                }
            )
            logger.info("super_admin_seeded", email=admin_email)
    except Exception as e:
        logger.error("super_admin_seed_failed", error=str(e))

    # Connect to Redis
    await connect_to_redis()
    logger.info("redis_connected")

    # Initialize app shutdown event for responsive SSE & WebSocket teardown
    app.state.shutdown_event = asyncio.Event()

    yield

    # Shutdown: 1. Signal shutdown immediately to all active SSE streams & background workers
    if hasattr(app.state, "shutdown_event"):
        app.state.shutdown_event.set()
        logger.info("shutdown_signal_dispatched")

    # 2. Close all active WebSockets
    try:
        from app.core.websocket_manager import websocket_manager
        await websocket_manager.close_all()
    except Exception as e:
        logger.warning("websocket_shutdown_error", error=str(e))

    # 3. Disconnect services
    await close_redis_connection()
    logger.info("redis_disconnected")

    await close_mongodb_connection()
    logger.info("mongodb_disconnected")

    logger.info("application_shutdown")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="eJournal API",
        description="Journal Management & Review System API",
        version="0.1.0",
        docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # CORS middleware (RULE-SEC12: allow only frontend origin)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register global exception handlers (RULE-ERR01, RULE-ERR02)
    register_exception_handlers(app)

    # Mount API v1 router (RULE-API02: versioned APIs)
    app.include_router(api_v1_router, prefix="/api/v1")

    # Serve static uploads with strict CSP and nosniff to prevent Stored XSS via SVGs (SEC-09)
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import Response
    import os
    os.makedirs("uploads", exist_ok=True)

    class SecureStaticFiles(StaticFiles):
        async def get_response(self, path: str, scope) -> Response:
            response = await super().get_response(path, scope)
            response.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'"
            response.headers["X-Content-Type-Options"] = "nosniff"
            return response

    app.mount("/uploads", SecureStaticFiles(directory="uploads"), name="uploads")

    return app


app = create_app()
