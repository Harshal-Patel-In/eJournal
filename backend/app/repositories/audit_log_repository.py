"""Repository class managing audit log persistence in MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
RULE-SEC10: Audit logs MUST be append-oriented and protected.
"""

from datetime import datetime, timezone
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository):
    """Audit log database access repository.

    Append-only: supports insertion but prevents updates/deletions.
    """

    collection_name = "audit_logs"

    async def log_event(
        self,
        user_id: str | None,
        action: str,
        entity: str,
        entity_id: str | None,
        ip_address: str | None = None,
    ) -> str:
        """Create a secure system audit log entry."""
        log_entry = {
            "userId": user_id,
            "action": action,
            "entity": entity,
            "entityId": entity_id,
            "timestamp": datetime.now(timezone.utc),
            "ipAddress": ip_address,
        }
        return await self.insert_one(log_entry)

    # Prevent updates and deletes to protect audit integrity (RULE-SEC10)
    async def update_one(self, filter: dict, update: dict, upsert: bool = False):
        raise NotImplementedError("Audit logs are append-only. Modification is prohibited.")

    async def update_by_id(self, id_str: str, update: dict):
        raise NotImplementedError("Audit logs are append-only. Modification is prohibited.")

    async def delete_one(self, filter: dict):
        raise NotImplementedError("Audit logs are append-only. Deletion is prohibited.")

    async def delete_by_id(self, id_str: str):
        raise NotImplementedError("Audit logs are append-only. Deletion is prohibited.")
