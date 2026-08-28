from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, or_, select
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

    async def count_by_category(
        self,
        session_id: UUID,
        category_id: UUID,
    ) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(Product)
            .where(
                Product.session_id == session_id,
                Product.category_id == category_id,
            )
        )
        return count or 0

    async def list_by_session(
        self,
        session_id: UUID,
        *,
        category_id: UUID | None = None,
        search: str | None = None,
        low_stock: bool | None = None,
    ) -> list[Product]:
        statement = select(Product).where(Product.session_id == session_id)

        if category_id is not None:
            statement = statement.where(Product.category_id == category_id)
        if search:
            statement = statement.where(
                or_(
                    Product.name.icontains(search, autoescape=True),
                    Product.sku.icontains(search, autoescape=True),
                )
            )
        if low_stock is True:
            statement = statement.where(
                Product.quantity <= Product.low_stock_threshold
            )
        elif low_stock is False:
            statement = statement.where(
                Product.quantity > Product.low_stock_threshold
            )

        result = await self.db.scalars(statement.order_by(Product.sku))
        return list(result)

    async def get_by_id(
        self,
        session_id: UUID,
        product_id: UUID,
    ) -> Product | None:
        result = await self.db.execute(
            select(Product).where(
                Product.session_id == session_id,
                Product.id == product_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_update(
        self,
        session_id: UUID,
        product_id: UUID,
    ) -> Product | None:
        result = await self.db.execute(
            select(Product)
            .where(
                Product.session_id == session_id,
                Product.id == product_id,
            )
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, session_id: UUID, sku: str) -> Product | None:
        result = await self.db.execute(
            select(Product).where(
                Product.session_id == session_id,
                Product.sku == sku,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, product: Product) -> Product:
        self.db.add(product)
        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def save(self, product: Product) -> Product:
        await self.db.flush()
        await self.db.refresh(product)
        return product

    async def delete(self, product: Product) -> None:
        await self.db.delete(product)
        await self.db.flush()

    async def create_many(self, products: Sequence[Product]) -> list[Product]:
        self.db.add_all(products)
        await self.db.flush()
        return list(products)

    async def delete_by_session(self, session_id: UUID) -> None:
        await self.db.execute(
            delete(Product).where(Product.session_id == session_id)
        )
