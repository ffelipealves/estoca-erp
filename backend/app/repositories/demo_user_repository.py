from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.demo_user import DemoUser


class DemoUserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def count_by_session(self, session_id: UUID) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(DemoUser)
            .where(DemoUser.session_id == session_id)
        )
        return count or 0

    async def get_by_email(self, session_id: UUID, email: str) -> DemoUser | None:
        result = await self.db.execute(
            select(DemoUser).where(
                DemoUser.session_id == session_id,
                DemoUser.email == email.strip().lower(),
            )
        )
        return result.scalar_one_or_none()

    async def list_by_session(self, session_id: UUID) -> list[DemoUser]:
        result = await self.db.scalars(
            select(DemoUser)
            .where(DemoUser.session_id == session_id)
            .order_by(DemoUser.email)
        )
        return list(result)

    async def create_many(self, users: Sequence[DemoUser]) -> list[DemoUser]:
        self.db.add_all(users)
        await self.db.flush()
        return list(users)
