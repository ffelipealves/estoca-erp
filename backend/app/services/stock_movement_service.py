from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StockMovementType
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository


class StockMovementService:
    def __init__(self, db: AsyncSession) -> None:
        self.products = ProductRepository(db)
        self.movements = StockMovementRepository(db)

    async def record_initial_stock(
        self,
        *,
        session_id: UUID,
        product: Product,
        performed_by_user_id: UUID,
        quantity: int,
    ) -> StockMovement:
        product.quantity = quantity
        await self.products.save(product)
        return await self.movements.create(
            StockMovement(
                session_id=session_id,
                product_id=product.id,
                performed_by_user_id=performed_by_user_id,
                type=StockMovementType.entrada,
                quantity=quantity,
                resulting_quantity=quantity,
                note="Estoque inicial",
            )
        )
