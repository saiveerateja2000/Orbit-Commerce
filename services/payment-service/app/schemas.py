import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models import PaymentMethod, PaymentStatus


class PaymentCreate(BaseModel):
    order_id: uuid.UUID
    user_id: uuid.UUID
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    payment_method: PaymentMethod


class PaymentResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    user_id: uuid.UUID
    amount: Decimal
    currency: str
    status: PaymentStatus
    payment_method: PaymentMethod
    transaction_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class RefundRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)
