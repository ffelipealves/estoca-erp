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

    async def delete_by_session(self, session_id: UUID) -> None:
        await self.db.execute(
            delete(StockMovement).where(StockMovement.session_id == session_id)
        )
