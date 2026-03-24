import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("product-service")

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Product
from app.schemas import (
    PaginatedProductResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)

router = APIRouter()

ADMIN_KEY = os.getenv("ADMIN_KEY", "changeme")
if ADMIN_KEY == "changeme":
    logger.warning(
        "ADMIN_KEY is using the insecure default value. "
        "Set the ADMIN_KEY environment variable to a secure secret in production."
    )


def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin key",
        )


@router.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "product-service"}


@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Products"],
)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin),
):
    product = Product(**payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get(
    "/products",
    response_model=PaginatedProductResponse,
    tags=["Products"],
)
async def list_products(
    category: Optional[str] = Query(default=None, description="Filter by category"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(Product).where(Product.is_active.is_(True))
    count_query = select(func.count()).select_from(Product).where(Product.is_active.is_(True))

    if category:
        base_query = base_query.where(Product.category == category)
        count_query = count_query.where(Product.category == category)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    products_result = await db.execute(
        base_query.order_by(Product.created_at.desc()).offset(offset).limit(page_size)
    )
    products = products_result.scalars().all()

    return PaginatedProductResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=list(products),
    )


@router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.is_active.is_(True))
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found",
        )
    return product


@router.put(
    "/products/{product_id}",
    response_model=ProductResponse,
    tags=["Products"],
)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    product.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Products"],
)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_admin),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.is_active.is_(True))
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found",
        )

    product.is_active = False
    product.updated_at = datetime.now(timezone.utc)
    await db.commit()
