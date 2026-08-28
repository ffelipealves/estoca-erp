from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, LimitExceededError, NotFoundError
from app.models.product import Product
from app.repositories.category_repository import CategoryRepository
from app.repositories.product_repository import ProductRepository
from app.services.stock_movement_service import StockMovementService

MAX_PRODUCTS_PER_SESSION = 50


class ProductService:
    def __init__(self, db: AsyncSession) -> None:
        self.products = ProductRepository(db)
        self.categories = CategoryRepository(db)
        self.stock_movements = StockMovementService(db)

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

    async def create(
        self,
        *,
        session_id: UUID,
        performed_by_user_id: UUID,
        category_id: UUID,
        name: str,
        sku: str,
        price: Decimal,
        initial_quantity: int,
        low_stock_threshold: int,
    ) -> Product:
        if await self.products.count_by_session(session_id) >= MAX_PRODUCTS_PER_SESSION:
            raise LimitExceededError("Limite de 50 produtos por sessão atingido")

        if await self.categories.get_by_id(session_id, category_id) is None:
            raise NotFoundError("Categoria não encontrada")

        if await self.products.get_by_sku(session_id, sku) is not None:
            raise ConflictError("Já existe um produto com este SKU")

        if initial_quantity > 0:
            await self.stock_movements.ensure_capacity(session_id)

        product = await self.products.create(
            Product(
                session_id=session_id,
                category_id=category_id,
                name=name,
                sku=sku,
                price=price,
                low_stock_threshold=low_stock_threshold,
            )
        )
        if initial_quantity > 0:
            await self.stock_movements.record_initial_stock(
                session_id=session_id,
                product=product,
                performed_by_user_id=performed_by_user_id,
                quantity=initial_quantity,
            )
        return product

    async def update(
        self,
        *,
        session_id: UUID,
        product_id: UUID,
        category_id: UUID,
        name: str,
        sku: str,
        price: Decimal,
        low_stock_threshold: int,
    ) -> Product:
        product = await self.get(session_id, product_id)

        if await self.categories.get_by_id(session_id, category_id) is None:
            raise NotFoundError("Categoria não encontrada")

        product_with_sku = await self.products.get_by_sku(session_id, sku)
        if product_with_sku is not None and product_with_sku.id != product.id:
            raise ConflictError("Já existe um produto com este SKU")

        product.category_id = category_id
        product.name = name
        product.sku = sku
        product.price = price
        product.low_stock_threshold = low_stock_threshold
        return await self.products.save(product)

    async def delete(self, session_id: UUID, product_id: UUID) -> None:
        product = await self.get(session_id, product_id)
        await self.products.delete(product)
