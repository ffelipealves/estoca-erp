from datetime import UTC, datetime, timedelta

from app.core.database import async_session_factory
from app.services.session_service import SessionService


async def test_resolve_or_create_reuses_active_session() -> None:
    started_at = datetime(2026, 8, 27, 12, tzinfo=UTC)

    async with async_session_factory() as db:
        service = SessionService(db)
        first_resolution = await service.resolve_or_create(None, now=started_at)
        second_resolution = await service.resolve_or_create(
            first_resolution.session.id,
            now=started_at + timedelta(minutes=15),
        )

        assert first_resolution.created
        assert not second_resolution.created
        assert second_resolution.session.id == first_resolution.session.id
        assert second_resolution.session.last_activity_at == started_at + timedelta(
            minutes=15
        )

        await db.rollback()


async def test_resolve_or_create_replaces_expired_session() -> None:
    started_at = datetime(2026, 8, 27, 12, tzinfo=UTC)

    async with async_session_factory() as db:
        service = SessionService(db)
        first_resolution = await service.resolve_or_create(None, now=started_at)
        replacement = await service.resolve_or_create(
            first_resolution.session.id,
            now=started_at + service.inactivity_limit,
        )

        assert replacement.created
        assert replacement.session.id != first_resolution.session.id

        await db.rollback()
