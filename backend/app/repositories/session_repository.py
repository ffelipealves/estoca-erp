from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session


class SessionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, session_id: UUID) -> Session | None:
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_update(self, session_id: UUID) -> Session | None:
        result = await self.db.execute(
            select(Session).where(Session.id == session_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def create(self, now: datetime) -> Session:
        session = Session(
            created_at=now,
            last_activity_at=now,
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def touch(self, session: Session, now: datetime) -> Session:
        session.last_activity_at = now
        await self.db.flush()
        return session

    async def delete_expired(
        self,
        *,
        inactivity_cutoff: datetime,
        max_age_cutoff: datetime,
    ) -> int:
        result = await self.db.execute(
            delete(Session)
            .where(
                or_(
                    Session.last_activity_at <= inactivity_cutoff,
                    Session.created_at <= max_age_cutoff,
                )
            )
            .returning(Session.id)
        )
        return len(result.scalars().all())
