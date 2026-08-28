from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models.product import Product
from app.repositories.product_repository import ProductRepository


class ProductService:
    def __init__(self, db: AsyncSession) -> None:
        self.products = ProductRepository(db)

    async def list(
        self,
        session_id: UUID,
        *,
        category_id: UUID | None = None,
        search: str | None = None,
        low_stock: bool | None = None,
    ) -> list[Product]:
        normalized_search = search.strip() if search else None
        return await self.products.list_by_session(
            session_id,
            category_id=category_id,
            search=normalized_search,
            low_stock=low_stock,
        )

    async def get(self, session_id: UUID, product_id: UUID) -> Product:
        product = await self.products.get_by_id(session_id, product_id)
        if product is None:
            raise NotFoundError("Produto não encontrado")
        return product
