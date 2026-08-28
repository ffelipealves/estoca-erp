from uuid import UUID

from fastapi import APIRouter, status

from app.core.deps import AdminUser, CurrentUser, DbSession
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.services.category_service import CategoryService


router = APIRouter(prefix="/categories", tags=["categories"])


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: CategoryCreate,
    admin_user: AdminUser,
    db: DbSession,
) -> CategoryResponse:
    category = await CategoryService(db).create(
        admin_user.session_id,
        payload.name,
    )
    return CategoryResponse.model_validate(category)


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    current_user: CurrentUser,
    db: DbSession,
) -> list[CategoryResponse]:
    categories = await CategoryService(db).list(current_user.session_id)
    return [CategoryResponse.model_validate(category) for category in categories]


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> CategoryResponse:
    category = await CategoryService(db).get(current_user.session_id, category_id)
    return CategoryResponse.model_validate(category)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    admin_user: AdminUser,
    db: DbSession,
) -> CategoryResponse:
    category = await CategoryService(db).update(
        admin_user.session_id,
        category_id,
        payload.name,
    )
    return CategoryResponse.model_validate(category)
