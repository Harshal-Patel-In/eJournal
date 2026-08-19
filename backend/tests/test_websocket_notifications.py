"""Unit tests for WebSocket ConnectionManager and Real-time Notification streaming."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.core.websocket_manager import ConnectionManager


@pytest.mark.anyio
async def test_websocket_manager_connect_and_disconnect():
    """Verify WebSocket registration, user mapping, and cleanup on disconnect."""
    manager = ConnectionManager()
    mock_ws = MagicMock()
    mock_ws.accept = AsyncMock()

    user_id = "user_123"
    await manager.connect(user_id, mock_ws)

    assert user_id in manager.active_connections
    assert mock_ws in manager.active_connections[user_id]
    assert mock_ws.accept.called

    await manager.disconnect(user_id, mock_ws)
    assert user_id not in manager.active_connections


@pytest.mark.anyio
async def test_websocket_manager_send_personal_notification():
    """Verify personal notification payload delivery to active sockets."""
    manager = ConnectionManager()
    mock_ws = MagicMock()
    mock_ws.accept = AsyncMock()
    mock_ws.send_json = AsyncMock()

    user_id = "user_456"
    await manager.connect(user_id, mock_ws)

    payload = {
        "type": "NEW_NOTIFICATION",
        "notification": {
            "title": "Journal Approved",
            "message": "Exp #1 approved: 10/10",
        },
    }
    await manager.send_personal_notification(user_id, payload)
    mock_ws.send_json.assert_called_once_with(payload)


@pytest.mark.anyio
async def test_websocket_manager_broadcast_to_multiple_users():
    """Verify concurrent broadcast to multiple enrolled users."""
    manager = ConnectionManager()
    ws1 = MagicMock()
    ws1.accept = AsyncMock()
    ws1.send_json = AsyncMock()

    ws2 = MagicMock()
    ws2.accept = AsyncMock()
    ws2.send_json = AsyncMock()

    await manager.connect("user_1", ws1)
    await manager.connect("user_2", ws2)

    payload = {"type": "NEW_NOTIFICATION", "notification": {"title": "New Assignment"}}
    await manager.broadcast_to_users(["user_1", "user_2"], payload)

    ws1.send_json.assert_called_once_with(payload)
    ws2.send_json.assert_called_once_with(payload)
