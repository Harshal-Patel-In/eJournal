"""Seed script framework.

RULE-MIG09: Seed scripts MUST be idempotent and MUST NOT contain production credentials.
Run: uv run python -m scripts.seed
"""

from pymongo import MongoClient
from app.core.config import settings


def seed_database():
    """Seed the database with initial development data.

    This script is idempotent — safe to run multiple times.
    """
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DATABASE]

    print(f"Seeding database: {settings.MONGODB_DATABASE}")

    # Placeholder: seed data will be added in later phases
    # when user, classroom, and assignment models are defined.
    print("  No seed data defined for Phase 1.")

    client.close()
    print("Seed complete.")


if __name__ == "__main__":
    seed_database()
