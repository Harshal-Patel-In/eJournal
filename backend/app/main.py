"""eJournal Backend - FastAPI Application Entry Point."""

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    setup_logging()
    logger.info("application_starting", environment=settings.ENVIRONMENT)

    # Connect to MongoDB Atlas
    await connect_to_mongodb()
    logger.info("mongodb_connected", database=settings.MONGODB_DATABASE)

    # Initialize collections and indexes (RULE-DB03)
    try:
        from scripts.create_indexes import create_indexes
        create_indexes()
        logger.info("mongodb_indexes_verified")
    except Exception as e:
        logger.error("mongodb_indexes_verification_failed", error=str(e))

    # Connect to Redis
    await connect_to_redis()
    logger.info("redis_connected")

    yield

    # Shutdown
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
