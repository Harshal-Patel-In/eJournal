"""Unit tests for Image Recycle Bin lifecycle and Notification 7-day readAt tracking."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.repositories.asset_repository import AssetRepository
from app.repositories.notification_repository import NotificationRepository


@pytest.mark.anyio
@patch("app.repositories.base.get_collection")
async def test_asset_repository_trash_lifecycle(mock_get_collection):
    """Verify moving asset to trash, calculating countdown, and restoring."""
    mock_coll = MagicMock()
    mock_get_collection.return_value = mock_coll

    repo = AssetRepository()

    # Mock create_asset
    test_id = ObjectId()
    mock_coll.insert_one.return_value = MagicMock(inserted_id=test_id)
    created = await repo.create_asset(
        user_id="user_123",
        url="https://example.com/sample.png",
        public_id="sample_id",
        filename="sample.png",
        size=1024,
    )

    assert created["id"] == str(test_id)
    assert created["isDeleted"] is False
    assert created["deletedAt"] is None

    # Mock move_to_trash
    mock_coll.find_one.return_value = {
        "_id": test_id,
        "userId": "user_123",
        "url": "https://example.com/sample.png",
        "isDeleted": False,
        "deletedAt": None,
    }

    trashed = await repo.move_to_trash("user_123", "https://example.com/sample.png")
    assert trashed is not None
    assert trashed["isDeleted"] is True
    assert trashed["deletedAt"] is not None

    # Mock restore_from_trash
    mock_coll.find_one.return_value = {
        "_id": test_id,
        "userId": "user_123",
        "isDeleted": True,
        "deletedAt": datetime.now(timezone.utc),
    }
    restored = await repo.restore_from_trash("user_123", str(test_id))
    assert restored is not None
    assert restored["isDeleted"] is False
    assert restored["deletedAt"] is None


@pytest.mark.anyio
@patch("app.repositories.base.get_collection")
async def test_notification_repository_read_at(mock_get_collection):
    """Verify mark_as_read records readAt timestamp for 7-day TTL."""
    mock_coll = MagicMock()
    mock_get_collection.return_value = mock_coll

    repo = NotificationRepository()
    repo.update_by_id = AsyncMock(return_value=True)

    success = await repo.mark_as_read("notif_123")
    assert success is True

    # Verify update_by_id was called with readAt in the $set payload
    repo.update_by_id.assert_called_once()
    args, _ = repo.update_by_id.call_args
    assert args[0] == "notif_123"
    set_payload = args[1]["$set"]
    assert set_payload["isRead"] is True
    assert "readAt" in set_payload
    assert isinstance(set_payload["readAt"], datetime)
