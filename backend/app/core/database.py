"""MongoDB connection manager.

RULE-BE07: Shared MongoDB client per process with driver connection pooling.
RULE-BE08: Config from environment-based settings.
RULE-BE10: Official MongoDB Python driver (PyMongo).
"""

import structlog
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure

from app.core.config import settings

logger = structlog.get_logger(__name__)

_client: MongoClient | None = None
_database: Database | None = None


import certifi


async def connect_to_mongodb() -> None:
    """Create shared MongoDB client with connection pool and automatic retry resilience."""
    global _client, _database

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            _client = MongoClient(
                settings.MONGODB_URI,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=20000,
                tlsCAFile=certifi.where(),
                retryWrites=True,
            )
            # Verify connection
            _client.admin.command("ping")
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
            import asyncio
            await asyncio.sleep(2 * attempt)

    _database = _client[settings.MONGODB_DATABASE]
    logger.info(
        "mongodb_pool_created",
        database=settings.MONGODB_DATABASE,
        min_pool=settings.MONGODB_MIN_POOL_SIZE,
        max_pool=settings.MONGODB_MAX_POOL_SIZE,
    )


async def close_mongodb_connection() -> None:
    """Close MongoDB client on shutdown."""
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None


def get_database() -> Database:
    """Get the shared database instance.

    Used by repositories to access collections.
    """
    if _database is None:
        raise RuntimeError("MongoDB is not connected. Call connect_to_mongodb() first.")
    return _database


def get_collection(name: str):
    """Get a MongoDB collection by name."""
    db = get_database()
    return db[name]


def get_mongo_client() -> MongoClient | None:
    """Get the shared MongoClient instance if connected."""
    return _client

