from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.category_repository import CategoryRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import SeedService


@dataclass(frozen=True, slots=True)
class SessionResetResult:
    categories_seeded: int
    products_seeded: int


class SessionResetService:
    def __init__(self, db: AsyncSession) -> None:
        self.movements = StockMovementRepository(db)
        self.products = ProductRepository(db)
        self.categories = CategoryRepository(db)
        self.seed = SeedService(db)

    async def reset(self, session_id: UUID) -> SessionResetResult:
        await self.movements.delete_by_session(session_id)
        await self.products.delete_by_session(session_id)
        await self.categories.delete_by_session(session_id)

        seed_result = await self.seed.seed_session(session_id)
        return SessionResetResult(
            categories_seeded=seed_result.categories_created,
            products_seeded=seed_result.products_created,
        )
