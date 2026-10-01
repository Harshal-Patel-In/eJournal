"""MongoDB connection manager with Motor (AsyncIO) and PyMongo (Sync).

RULE-BE07: Shared MongoDB client per process with driver connection pooling.
RULE-BE08: Config from environment-based settings.
RULE-BE10: Official MongoDB Python drivers (Motor async + PyMongo sync).
"""

import asyncio
import structlog
import certifi
from pymongo import MongoClient
from pymongo.database import Database
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection

from app.core.config import settings

logger = structlog.get_logger(__name__)

# DNS fallback for Windows/ISP network environments
try:
    import dns.resolver

    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ["8.8.8.8", "1.1.1.1"]
except Exception:
    pass

# Shared clients
_motor_client: AsyncIOMotorClient | None = None
_motor_database: AsyncIOMotorDatabase | None = None
_sync_client: MongoClient | None = None
_sync_database: Database | None = None


async def connect_to_mongodb() -> None:
    """Create shared Motor (async) and PyMongo (sync) clients with connection pooling."""
    global _motor_client, _motor_database, _sync_client, _sync_database

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            # 1. Initialize Sync PyMongo client (used for startup scripts & admin sync helpers)
            _sync_client = MongoClient(
                settings.MONGODB_URI,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=20000,
                tlsCAFile=certifi.where(),
                retryWrites=True,
            )
            _sync_client.admin.command("ping")
            _sync_database = _sync_client[settings.MONGODB_DATABASE]

            # 2. Initialize Async Motor client (used for all high-concurrency HTTP routes)
            _motor_client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=20000,
                tlsCAFile=certifi.where(),
                retryWrites=True,
            )
            # Verify async connection
            await _motor_client.admin.command("ping")
            _motor_database = _motor_client[settings.MONGODB_DATABASE]
            break
        except Exception as e:
            logger.warning("mongodb_connection_retry", attempt=attempt, max_attempts=max_attempts, error=str(e))
            if attempt == max_attempts:
                logger.error("mongodb_connection_failed", error=str(e))
                print("\n" + "=" * 80)
                print("CRITICAL CONNECTION ERROR: MongoDB Atlas handshake failed.")
                print("This could be due to a DNS timeout or IP whitelist issue in MongoDB Atlas.")
                print("=" * 80 + "\n")
                raise
            await asyncio.sleep(2 * attempt)

    logger.info(
        "mongodb_pools_created",
        database=settings.MONGODB_DATABASE,
        min_pool=settings.MONGODB_MIN_POOL_SIZE,
        max_pool=settings.MONGODB_MAX_POOL_SIZE,
    )


async def close_mongodb_connection() -> None:
    """Close MongoDB clients on shutdown."""
    global _motor_client, _motor_database, _sync_client, _sync_database
    if _motor_client is not None:
        _motor_client.close()
        _motor_client = None
        _motor_database = None
    if _sync_client is not None:
        _sync_client.close()
        _sync_client = None
        _sync_database = None


def get_async_database() -> AsyncIOMotorDatabase:
    """Get the shared Motor asynchronous database instance."""
    if _motor_database is None:
        raise RuntimeError("Motor MongoDB is not connected. Call connect_to_mongodb() first.")
    return _motor_database


def get_async_collection(name: str) -> AsyncIOMotorCollection:
    """Get an asynchronous Motor collection by name."""
    db = get_async_database()
    return db[name]


def get_database() -> Database:
    """Get the shared synchronous PyMongo database instance."""
    if _sync_database is None:
        raise RuntimeError("MongoDB is not connected. Call connect_to_mongodb() first.")
    return _sync_database


def get_collection(name: str) -> AsyncIOMotorCollection:
    """Get a MongoDB collection by name. Defaults to Motor async collection for repository operations."""
    return get_async_collection(name)


def get_mongo_client() -> MongoClient | None:
    """Get the shared MongoClient instance if connected."""
    return _sync_client


def get_motor_client() -> AsyncIOMotorClient | None:
    """Get the shared AsyncIOMotorClient instance if connected."""
    return _motor_client
