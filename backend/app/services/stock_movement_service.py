from dataclasses import dataclass
from math import ceil
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, LimitExceededError, NotFoundError
from app.models.enums import StockMovementType
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.repositories.product_repository import ProductRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.stock_movement_repository import StockMovementRepository


MAX_MOVEMENTS_PER_SESSION = 500


@dataclass(frozen=True, slots=True)
class StockMovementPageResult:
    items: list[StockMovement]
    page: int
    page_size: int
    total: int

    @property
    def pages(self) -> int:
        return ceil(self.total / self.page_size)


class StockMovementService:
    def __init__(self, db: AsyncSession) -> None:
        self.products = ProductRepository(db)
        self.movements = StockMovementRepository(db)
        self.sessions = SessionRepository(db)

    async def list(
        self,
        session_id: UUID,
        *,
        page: int,
        page_size: int,
        product_id: UUID | None = None,
    ) -> StockMovementPageResult:
        items, total = await self.movements.list_paginated(
            session_id,
            offset=(page - 1) * page_size,
            limit=page_size,
            product_id=product_id,
        )
        return StockMovementPageResult(
            items=items,
            page=page,
            page_size=page_size,
            total=total,
        )

    async def ensure_capacity(self, session_id: UUID) -> None:
        session = await self.sessions.get_by_id_for_update(session_id)
        if session is None:
            raise NotFoundError("Sessão não encontrada")
        if (
            await self.movements.count_by_session(session_id)
            >= MAX_MOVEMENTS_PER_SESSION
        ):
            raise LimitExceededError(
                "Limite de 500 movimentações por sessão atingido"
            )

    async def record_initial_stock(
        self,
        *,
        session_id: UUID,
        product: Product,
        performed_by_user_id: UUID,
        quantity: int,
    ) -> StockMovement:
        if quantity <= 0:
            raise BusinessRuleError("A quantidade deve ser maior que zero")
        await self.ensure_capacity(session_id)
        scoped_product = await self.products.get_by_id_for_update(
            session_id,
            product.id,
        )
        if scoped_product is None:
            raise NotFoundError("Produto não encontrado")

        scoped_product.quantity = quantity
        await self.products.save(scoped_product)
        return await self.movements.create(
            StockMovement(
                session_id=session_id,
                product_id=scoped_product.id,
                performed_by_user_id=performed_by_user_id,
                type=StockMovementType.entrada,
                quantity=quantity,
                resulting_quantity=quantity,
                note="Estoque inicial",
            )
        )

    async def create(
        self,
        *,
        session_id: UUID,
        product_id: UUID,
        performed_by_user_id: UUID,
        movement_type: StockMovementType,
        quantity: int,
        note: str | None = None,
    ) -> StockMovement:
        self._validate_quantity(movement_type, quantity)
        await self.ensure_capacity(session_id)

        product = await self.products.get_by_id_for_update(session_id, product_id)
        if product is None:
            raise NotFoundError("Produto não encontrado")

        resulting_quantity = self._calculate_resulting_quantity(
            current_quantity=product.quantity,
            movement_type=movement_type,
            quantity=quantity,
        )
        product.quantity = resulting_quantity
        await self.products.save(product)
        normalized_note = note.strip() if note is not None else None
        normalized_note = normalized_note or None

        return await self.movements.create(
            StockMovement(
                session_id=session_id,
                product_id=product.id,
                performed_by_user_id=performed_by_user_id,
                type=movement_type,
                quantity=quantity,
                resulting_quantity=resulting_quantity,
                note=normalized_note,
            )
        )

    @staticmethod
    def _validate_quantity(
        movement_type: StockMovementType,
        quantity: int,
    ) -> None:
        if movement_type in {
            StockMovementType.entrada,
            StockMovementType.saida,
        } and quantity <= 0:
            raise BusinessRuleError("A quantidade deve ser maior que zero")
        if movement_type is StockMovementType.ajuste and quantity < 0:
            raise BusinessRuleError(
                "A quantidade final do ajuste não pode ser negativa"
            )

    @staticmethod
    def _calculate_resulting_quantity(
        *,
        current_quantity: int,
        movement_type: StockMovementType,
        quantity: int,
    ) -> int:
        if movement_type is StockMovementType.entrada:
            return current_quantity + quantity
        if movement_type is StockMovementType.ajuste:
            return quantity
        if quantity > current_quantity:
            raise BusinessRuleError("Saldo insuficiente para esta saída")
        return current_quantity - quantity
