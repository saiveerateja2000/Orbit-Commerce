import logging
import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Notification, NotificationStatus
from app.schemas import (
    BulkNotificationCreate,
    BulkNotificationResponse,
    NotificationCreate,
    NotificationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_SEND_SUCCESS_RATE = 0.95


def _simulate_send() -> NotificationStatus:
    """Simulate delivery with a 95 % success rate."""
    return NotificationStatus.sent if random.random() < _SEND_SUCCESS_RATE else NotificationStatus.failed


async def _persist_notification(
    payload: NotificationCreate,
    db: AsyncSession,
) -> Notification:
    """Create a Notification record, simulate sending, and persist the result."""
    outcome = _simulate_send()
    now = datetime.now(timezone.utc)

    notification = Notification(
        user_id=payload.user_id,
        type=payload.type,
        subject=payload.subject,
        message=payload.message,
        status=outcome,
        reference_id=payload.reference_id,
        sent_at=now if outcome == NotificationStatus.sent else None,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)

    logger.info(
        "Notification %s (%s) for user %s – status: %s",
        notification.id,
        notification.type,
        notification.user_id,
        notification.status,
    )
    return notification


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "service": "notification-service"}


# ---------------------------------------------------------------------------
# POST /notifications  –  create and simulate sending a notification
# ---------------------------------------------------------------------------


@router.post(
    "/notifications",
    response_model=NotificationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Notifications"],
)
async def create_notification(
    payload: NotificationCreate,
    db: AsyncSession = Depends(get_db),
):
    notification = await _persist_notification(payload, db)
    await db.commit()
    await db.refresh(notification)
    return notification


# ---------------------------------------------------------------------------
# GET /notifications/user/{user_id}  –  all notifications for a user
# NOTE: this route must be declared BEFORE /notifications/{id} so that
#       the literal segment "user" is not treated as a UUID path parameter.
# ---------------------------------------------------------------------------


@router.get(
    "/notifications/user/{user_id}",
    response_model=list[NotificationResponse],
    tags=["Notifications"],
)
async def get_notifications_by_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /notifications/{id}  –  fetch a single notification
# ---------------------------------------------------------------------------


@router.get(
    "/notifications/{notification_id}",
    response_model=NotificationResponse,
    tags=["Notifications"],
)
async def get_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found",
        )
    return notification


# ---------------------------------------------------------------------------
# POST /notifications/bulk  –  send multiple notifications in one request
# ---------------------------------------------------------------------------


@router.post(
    "/notifications/bulk",
    response_model=BulkNotificationResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Notifications"],
)
async def create_bulk_notifications(
    payload: BulkNotificationCreate,
    db: AsyncSession = Depends(get_db),
):
    results: list[Notification] = []
    for item in payload.notifications:
        notification = await _persist_notification(item, db)
        results.append(notification)

    await db.commit()
    for n in results:
        await db.refresh(n)

    sent_count = sum(1 for n in results if n.status == NotificationStatus.sent)
    failed_count = len(results) - sent_count

    logger.info(
        "Bulk send complete – total: %d, sent: %d, failed: %d",
        len(results),
        sent_count,
        failed_count,
    )
    return BulkNotificationResponse(
        total=len(results),
        sent=sent_count,
        failed=failed_count,
        items=results,
    )
