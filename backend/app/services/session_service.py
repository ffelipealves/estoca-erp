from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.session import Session
from app.repositories.session_repository import SessionRepository


@dataclass(frozen=True, slots=True)
class SessionResolution:
    session: Session
    created: bool


class SessionService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = SessionRepository(db)
        self.inactivity_limit = timedelta(
            minutes=settings.session_inactivity_minutes
        )
        self.max_age = timedelta(hours=settings.session_max_age_hours)

    async def resolve_or_create(
        self,
        session_id: UUID | None,
        *,
        now: datetime | None = None,
    ) -> SessionResolution:
        resolved_at = now or datetime.now(UTC)

        if session_id is not None:
            session = await self.repository.get_by_id(session_id)
            if session is not None and not self.is_expired(session, resolved_at):
                await self.repository.touch(session, resolved_at)
                return SessionResolution(session=session, created=False)

        session = await self.repository.create(resolved_at)
        return SessionResolution(session=session, created=True)

    def is_expired(self, session: Session, now: datetime) -> bool:
        inactive_for = now - session.last_activity_at
        age = now - session.created_at
        return inactive_for >= self.inactivity_limit or age >= self.max_age
