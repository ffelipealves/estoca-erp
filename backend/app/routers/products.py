from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.schemas.product import ProductCreate, ProductResponse
from app.services.product_service import ProductService


router = APIRouter(prefix="/products", tags=["products"])


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    payload: ProductCreate,
    admin_user: AdminUser,
    db: DbSession,
) -> ProductResponse:
    product = await ProductService(db).create(
        session_id=admin_user.session_id,
        performed_by_user_id=admin_user.id,
        category_id=payload.category_id,
        name=payload.name,
        sku=payload.sku,
        price=payload.price,
        initial_quantity=payload.initial_quantity,
        low_stock_threshold=payload.low_stock_threshold,
    )
    return ProductResponse.model_validate(product)


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
