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
    ) -> list[tuple[datetime, int]]:
        """Saldo total da sessão após cada movimentação, em ordem cronológica.

        `resulting_quantity` é o saldo *daquele produto*, então somá-lo direto
        daria um número sem sentido. `LAG` particionado por produto devolve o
        saldo anterior do mesmo produto; a diferença é quanto aquele evento moveu
        o estoque como um todo, e a soma corrente desses deltas é o saldo total
        ao longo do tempo. Uma consulta só, sem replay no cliente.

        Premissa: dois eventos do mesmo produto não compartilham `created_at`.
        Com empate, a ordem entre eles cairia no UUID — arbitrária — e a cadeia
        telescoparia para um saldo que não é o último, fazendo o ponto final
        divergir do catálogo. Cada escrita da API é uma transação própria, e o
        seed espalha o histórico justamente para não empatar.
        """
        previous = func.lag(StockMovement.resulting_quantity).over(
            partition_by=StockMovement.product_id,
            order_by=(StockMovement.created_at, StockMovement.id),
        )
        deltas = (
            select(
                StockMovement.id.label("id"),
                StockMovement.created_at.label("at"),
                (StockMovement.resulting_quantity - func.coalesce(previous, 0)).label(
                    "delta"
                ),
            )
            .where(StockMovement.session_id == session_id)
            .subquery()
        )

        statement = select(
            deltas.c.at,
            func.sum(deltas.c.delta)
            .over(order_by=(deltas.c.at, deltas.c.id))
            .label("total"),
        ).order_by(deltas.c.at, deltas.c.id)

        result = await self.db.execute(statement)
        return [(row.at, int(row.total)) for row in result]

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
