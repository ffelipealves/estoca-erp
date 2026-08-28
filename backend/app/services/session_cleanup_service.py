from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.session_repository import SessionRepository


class SessionCleanupService:
    def __init__(self, db: AsyncSession) -> None:
        self.sessions = SessionRepository(db)
        self.inactivity_limit = timedelta(minutes=settings.session_inactivity_minutes)
        self.max_age = timedelta(hours=settings.session_max_age_hours)

    async def delete_expired(self, *, now: datetime | None = None) -> int:
        resolved_at = now or datetime.now(UTC)
        return await self.sessions.delete_expired(
            inactivity_cutoff=resolved_at - self.inactivity_limit,
            max_age_cutoff=resolved_at - self.max_age,
        )

    async def delete_all(self) -> int:
        return await self.sessions.delete_all()
