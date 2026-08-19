"""WebSocket Connection Manager for Real-Time User Notifications.

Manages persistent WebSocket connections mapped per authenticated user_id,
supporting user-targeted and multi-user broadcast notification streaming.
"""

import asyncio
import json
import logging
from typing import Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections grouped by user ID."""

    def __init__(self) -> None:
        # Map of user_id -> list of active WebSocket instances
        self.active_connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Accept an incoming WebSocket connection and register under the user ID."""
        await websocket.accept()
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket client connected for user {user_id}. Total active: {len(self.active_connections[user_id])}")

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket instance."""
        async with self._lock:
            if user_id in self.active_connections:
                if websocket in self.active_connections[user_id]:
                    self.active_connections[user_id].remove(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        logger.info(f"WebSocket client disconnected for user {user_id}.")

    async def send_personal_notification(self, user_id: str, payload: dict[str, Any]) -> None:
        """Send a real-time notification payload to all active sockets of a specific user."""
        async with self._lock:
            sockets = list(self.active_connections.get(user_id, []))

        if not sockets:
            return

        dead_sockets: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message to user {user_id}: {e}")
                dead_sockets.append(socket)

        if dead_sockets:
            async with self._lock:
                if user_id in self.active_connections:
                    for dead in dead_sockets:
                        if dead in self.active_connections[user_id]:
                            self.active_connections[user_id].remove(dead)
                    if not self.active_connections[user_id]:
                        del self.active_connections[user_id]

    async def broadcast_to_users(self, user_ids: list[str], payload: dict[str, Any]) -> None:
        """Concurrently send a notification payload to multiple specified user IDs."""
        tasks = [self.send_personal_notification(uid, payload) for uid in user_ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


# Global singleton instance
websocket_manager = ConnectionManager()
