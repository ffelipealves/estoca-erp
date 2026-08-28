from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession
from app.schemas.product import ProductResponse
from app.services.product_service import ProductService


router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
async def list_products(
    current_user: CurrentUser,
    db: DbSession,
    category_id: UUID | None = None,
    search: Annotated[str | None, Query(min_length=1, max_length=150)] = None,
    low_stock: bool | None = None,
) -> list[ProductResponse]:
    products = await ProductService(db).list(
        current_user.session_id,
        category_id=category_id,
        search=search,
        low_stock=low_stock,
    )
    return [ProductResponse.model_validate(product) for product in products]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> ProductResponse:
    product = await ProductService(db).get(current_user.session_id, product_id)
    return ProductResponse.model_validate(product)
