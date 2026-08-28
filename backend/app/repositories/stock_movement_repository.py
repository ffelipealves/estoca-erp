from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
    ) -> tuple[list[StockMovement], int]:
        filters = [StockMovement.session_id == session_id]
        if product_id is not None:
            filters.append(StockMovement.product_id == product_id)

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
