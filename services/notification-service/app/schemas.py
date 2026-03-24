import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models import NotificationStatus, NotificationType


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    type: NotificationType
    subject: str = Field(..., min_length=1, max_length=500)
    message: str = Field(..., min_length=1)
    reference_id: Optional[uuid.UUID] = None


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: NotificationType
    subject: str
    message: str
    status: NotificationStatus
    reference_id: Optional[uuid.UUID]
    created_at: datetime
    sent_at: Optional[datetime]

    model_config = {"from_attributes": True}


class BulkNotificationCreate(BaseModel):
    notifications: list[NotificationCreate] = Field(..., min_length=1)


class BulkNotificationResponse(BaseModel):
    total: int
    sent: int
    failed: int
    items: list[NotificationResponse]
