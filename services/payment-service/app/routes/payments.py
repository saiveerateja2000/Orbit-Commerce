import logging
import random
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Payment, PaymentMethod, PaymentStatus
from app.schemas import PaymentCreate, PaymentResponse, RefundRequest

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "service": "payment-service"}


# ---------------------------------------------------------------------------
# POST /payments  –  simulate a new payment (90 % success rate)
# ---------------------------------------------------------------------------


@router.post(
    "/payments",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Payments"],
)
async def create_payment(
    payload: PaymentCreate,
    db: AsyncSession = Depends(get_db),
):
    # Simulate processing: 90 % success, 10 % failure
    outcome = (
        PaymentStatus.success if random.random() < 0.90 else PaymentStatus.failed
    )

    payment = Payment(
        order_id=payload.order_id,
        user_id=payload.user_id,
        amount=payload.amount,
        currency=payload.currency.upper(),
        payment_method=payload.payment_method,
        status=outcome,
        transaction_id=uuid.uuid4(),
    )
    db.add(payment)
    await db.flush()
    await db.commit()
    await db.refresh(payment)

    logger.info(
        "Payment %s created for order %s – status: %s",
        payment.id,
        payment.order_id,
        payment.status,
    )
    return payment


# ---------------------------------------------------------------------------
# GET /payments/{id}  –  fetch a single payment by its own ID
# ---------------------------------------------------------------------------


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentResponse,
    tags=["Payments"],
)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found",
        )
    return payment


# ---------------------------------------------------------------------------
# GET /payments/order/{order_id}  –  fetch all payments for an order
# ---------------------------------------------------------------------------


@router.get(
    "/payments/order/{order_id}",
    response_model=list[PaymentResponse],
    tags=["Payments"],
)
async def get_payments_by_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.order_id == order_id)
        .order_by(Payment.created_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# POST /payments/{id}/refund  –  simulate a refund
# ---------------------------------------------------------------------------


@router.post(
    "/payments/{payment_id}/refund",
    response_model=PaymentResponse,
    tags=["Payments"],
)
async def refund_payment(
    payment_id: uuid.UUID,
    payload: RefundRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()

    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found",
        )

    if payment.status != PaymentStatus.success:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Cannot refund a payment with status '{payment.status.value}'. "
                "Only 'success' payments are eligible for refund."
            ),
        )

    payment.status = PaymentStatus.refunded
    await db.flush()
    await db.commit()
    await db.refresh(payment)

    logger.info(
        "Payment %s refunded – reason: %s",
        payment.id,
        payload.reason,
    )
    return payment
