from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.stock_movement import (
    StockMovementCreate,
    StockMovementPage,
    StockMovementResponse,
)
from app.services.stock_movement_service import StockMovementService

router = APIRouter(prefix="/stock-movements", tags=["stock-movements"])


@router.post(
    "",
    response_model=StockMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_stock_movement(
    payload: StockMovementCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> StockMovementResponse:
    movement = await StockMovementService(db).create(
        session_id=current_user.session_id,
        product_id=payload.product_id,
        performed_by_user_id=current_user.id,
        movement_type=payload.type,
        quantity=payload.quantity,
        note=payload.note,
    )
    return StockMovementResponse.model_validate(movement)


@router.get("", response_model=StockMovementPage)
async def list_stock_movements(
    current_user: CurrentUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    product_id: UUID | None = None,
) -> StockMovementPage:
    result = await StockMovementService(db).list(
        current_user.session_id,
        page=page,
        page_size=page_size,
        product_id=product_id,
    )
    return StockMovementPage(
        items=[
            StockMovementResponse.model_validate(movement) for movement in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        total=result.total,
        pages=result.pages,
    )
