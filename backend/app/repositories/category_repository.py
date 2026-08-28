from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category


class CategoryRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_by_session(self, session_id: UUID) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(Category)
            .where(Category.session_id == session_id)
        )
        return count or 0

    async def list_by_session(self, session_id: UUID) -> list[Category]:
        result = await self.db.scalars(
            select(Category)
            .where(Category.session_id == session_id)
            .order_by(Category.name)
        )
        return list(result)

    async def create_many(self, categories: Sequence[Category]) -> list[Category]:
        self.db.add_all(categories)
        await self.db.flush()
        return list(categories)

    async def delete_by_session(self, session_id: UUID) -> None:
        await self.db.execute(
            delete(Category).where(Category.session_id == session_id)
        )
