from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class ProductRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_by_session(self, session_id: UUID) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(Product)
            .where(Product.session_id == session_id)
        )
        return count or 0

    async def list_by_session(self, session_id: UUID) -> list[Product]:
        result = await self.db.scalars(
            select(Product)
            .where(Product.session_id == session_id)
            .order_by(Product.sku)
        )
        return list(result)

    async def create_many(self, products: Sequence[Product]) -> list[Product]:
        self.db.add_all(products)
        await self.db.flush()
        return list(products)

    async def delete_by_session(self, session_id: UUID) -> None:
        await self.db.execute(
            delete(Product).where(Product.session_id == session_id)
        )
