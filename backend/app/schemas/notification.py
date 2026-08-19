"""In-app notifications schemas.

RULE-BE03: All request and response models MUST be defined as Pydantic schemas.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Notification details returned in responses."""
    id: str = Field(..., description="Unique notification identifier")
    userId: str = Field(..., description="Recipient user identifier")
    title: str = Field(..., description="Notification short title")
    message: str = Field(..., description="Detailed notification content body")
    type: str = Field(..., description="Notification category (e.g. assignment, submission)")
    isRead: bool = Field(..., description="Has student/teacher read this notification")
    link: str | None = Field(None, description="Optional relative UI path to route user click action")
    metadata: dict | None = Field(None, description="Structured event metadata for deep-linking, filtering and categorizing")
    createdAt: datetime = Field(..., description="Time notification was dispatched")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "id": "notif_100",
                "userId": "student_999",
                "title": "New Assignment Published",
                "message": "Experiment 2: Ohm's Law has been published.",
                "type": "assignment",
                "isRead": False,
                "link": "/classrooms/class_123",
                "createdAt": "2026-07-19T13:00:00Z",
            }
        }
    }
