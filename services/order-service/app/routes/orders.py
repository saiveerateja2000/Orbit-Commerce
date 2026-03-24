import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Order, OrderItem, OrderStatus
from app.schemas import (
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
    PaginatedOrderResponse,
)

logger = logging.getLogger("order-service")

router = APIRouter()


def _require_user_id(x_user_id: str = Header(...)) -> uuid.UUID:
    try:
        return uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id header must be a valid UUID",
        )


@router.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "order-service"}


@router.post(
    "/orders",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Orders"],
)
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_require_user_id),
):
    total_amount = sum(
        item.quantity * item.unit_price for item in payload.items
    )

    order = Order(
        user_id=user_id,
        status=OrderStatus.pending,
        total_amount=total_amount,
    )
    db.add(order)
    await db.flush()

    for item_data in payload.items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
        )
        db.add(order_item)

    await db.commit()
    await db.refresh(order)
    logger.info("Created order %s for user %s", order.id, user_id)
    return order


@router.get(
    "/orders",
    response_model=PaginatedOrderResponse,
    tags=["Orders"],
)
async def list_orders(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_require_user_id),
):
    count_query = (
        select(func.count()).select_from(Order).where(Order.user_id == user_id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    orders_result = await db.execute(
        select(Order)
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    orders = orders_result.scalars().all()

    return PaginatedOrderResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=list(orders),
    )


@router.get(
    "/orders/{order_id}",
    response_model=OrderResponse,
    tags=["Orders"],
)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_require_user_id),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )
    return order


@router.put(
    "/orders/{order_id}/status",
    response_model=OrderResponse,
    tags=["Orders"],
)
async def update_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_require_user_id),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    if order.status == OrderStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update status of a cancelled order",
        )

    order.status = payload.status
    order.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    logger.info("Updated order %s status to %s", order_id, payload.status)
    return order


@router.delete(
    "/orders/{order_id}",
    response_model=OrderResponse,
    tags=["Orders"],
)
async def cancel_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_require_user_id),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    if order.status == OrderStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Order is already cancelled",
        )

    if order.status == OrderStatus.delivered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot cancel a delivered order",
        )

    order.status = OrderStatus.cancelled
    order.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)
    logger.info("Cancelled order %s for user %s", order_id, user_id)
    return order
