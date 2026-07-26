"""Repository class managing user persistence inside MongoDB.

RULE-BE05: All database operations live inside repository classes.
RULE-BE06: Never return raw MongoDB documents.
"""

from datetime import datetime, timezone

from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    """User database access repository."""

    collection_name = "users"

    async def find_by_email(self, email: str) -> dict | None:
        """Look up user by unique email."""
        doc = self.collection.find_one({"email": email.lower().strip()})
        return self._to_str_id(doc)

    async def update_otp(
        self, user_id: str, otp: str, expires_at: datetime
    ) -> bool:
        """Store verification OTP with expiration timeline."""
        return await self.update_by_id(
            user_id,
            {
                "$set": {
                    "otp": otp,
                    "otp_expires_at": expires_at,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )

    async def verify_user(self, user_id: str) -> bool:
        """Mark user account as verified and clear OTP credentials."""
        return await self.update_by_id(
            user_id,
            {
                "$set": {
                    "is_verified": True,
                    "updatedAt": datetime.now(timezone.utc),
                },
                "$unset": {
                    "otp": "",
                    "otp_expires_at": "",
                },
            },
        )

    async def update_profile(
        self, user_id: str, profile_data: dict, is_complete: bool
    ) -> bool:
        """Update embedded academic profile fields and profile completion lock state."""
        update_fields = {}
        for key, val in profile_data.items():
            if val is not None:
                update_fields[f"profile.{key}"] = val

        update_fields["is_profile_complete"] = is_complete
        update_fields["updatedAt"] = datetime.now(timezone.utc)

        return await self.update_by_id(user_id, {"$set": update_fields})
