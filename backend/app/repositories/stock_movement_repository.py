from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import StockMovementType
from app.models.stock_movement import StockMovement


class StockMovementRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_by_session(self, session_id: UUID) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(StockMovement)
            .where(StockMovement.session_id == session_id)
        )
        return count or 0

    async def list_by_product(
        self,
        session_id: UUID,
        product_id: UUID,
    ) -> list[StockMovement]:
        result = await self.db.scalars(
            select(StockMovement)
            .where(
                StockMovement.session_id == session_id,
                StockMovement.product_id == product_id,
            )
            .order_by(StockMovement.created_at, StockMovement.id)
        )
        return list(result)

    async def list_paginated(
        self,
        session_id: UUID,
        *,
        offset: int,
        limit: int,
        product_id: UUID | None = None,
        movement_type: StockMovementType | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[StockMovement], int]:
        filters = [StockMovement.session_id == session_id]
        if product_id is not None:
            filters.append(StockMovement.product_id == product_id)
        if movement_type is not None:
            filters.append(StockMovement.type == movement_type)
        if created_from is not None:
            filters.append(StockMovement.created_at >= created_from)
        if created_to is not None:
            filters.append(StockMovement.created_at <= created_to)

        total = await self.db.scalar(
            select(func.count()).select_from(StockMovement).where(*filters)
        )
        result = await self.db.scalars(
            select(StockMovement)
            .where(*filters)
            .order_by(StockMovement.created_at.desc(), StockMovement.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result), total or 0

    async def balance_timeline(
        self,
        session_id: UUID,
    ) -> list[tuple[UUID, datetime, StockMovementType, UUID, int, int]]:
        """Saldo total da sessão após cada movimentação, em ordem cronológica.

        Cada linha devolve `(id, created_at, type, product_id, delta, total)`.
        O delta é quanto aquele evento moveu o estoque como um todo:
        `resulting_quantity - previous_quantity`, os dois gravados sob o lock do
        produto — então ele é exato mesmo quando escritas concorrentes no mesmo
        produto têm `created_at` fora da ordem real. A soma corrente dos deltas é
        o saldo total ao longo do tempo, numa consulta só, sem replay no cliente.
        O último ponto sempre fecha com a soma dos saldos do catálogo; empates de
        `created_at` só decidem a ordem dos pontos intermediários, pelo `id`.
        """
        delta = StockMovement.resulting_quantity - StockMovement.previous_quantity
        order = (StockMovement.created_at, StockMovement.id)
        statement = (
            select(
                StockMovement.id,
                StockMovement.created_at,
                StockMovement.type,
                StockMovement.product_id,
                delta.label("delta"),
                func.sum(delta).over(order_by=order).label("total"),
            )
            .where(StockMovement.session_id == session_id)
            .order_by(*order)
        )

        result = await self.db.execute(statement)
        return [
            (
                row.id,
                row.created_at,
                row.type,
                row.product_id,
                int(row.delta),
                int(row.total),
            )
            for row in result
        ]

    async def create(self, movement: StockMovement) -> StockMovement:
        self.db.add(movement)
        await self.db.flush()
        await self.db.refresh(movement)
        return movement

    async def create_many(
        self,
        movements: Sequence[StockMovement],
    ) -> list[StockMovement]:
        self.db.add_all(movements)
        await self.db.flush()
        return list(movements)

    async def delete_by_session(self, session_id: UUID) -> None:
        await self.db.execute(
            delete(StockMovement).where(StockMovement.session_id == session_id)
        )
