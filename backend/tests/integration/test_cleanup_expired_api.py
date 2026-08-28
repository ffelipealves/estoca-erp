from datetime import UTC, datetime, timedelta

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
from app.repositories.category_repository import CategoryRepository
from app.repositories.session_repository import SessionRepository
from app.services.seed_service import SeedService


async def test_cleanup_expired_requires_secret_and_preserves_active_sessions() -> None:
    now = datetime.now(UTC)
    active_session_id = None

    async with async_session_factory() as db:
        sessions = SessionRepository(db)

        inactive = await sessions.create(now - timedelta(hours=3))
        inactive.last_activity_at = now - timedelta(hours=2, minutes=1)
        await SeedService(db).seed_session(inactive.id)

        too_old = await sessions.create(now - timedelta(hours=24, minutes=1))
        too_old.last_activity_at = now

        active = await sessions.create(now - timedelta(hours=1))
        active.last_activity_at = now
        active_session_id = active.id
        await SeedService(db).seed_session(active.id)
        expired_session_ids = {inactive.id, too_old.id}
        await db.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            missing_secret = await client.post("/internal/cleanup/expired")
            wrong_secret = await client.post(
                "/internal/cleanup/expired",
                headers={"X-Cron-Secret": "segredo-incorreto"},
            )
            assert missing_secret.status_code == 403
            assert wrong_secret.status_code == 403

            async with async_session_factory() as db:
                for session_id in expired_session_ids:
                    assert await SessionRepository(db).get_by_id(session_id) is not None

            cleanup = await client.post(
                "/internal/cleanup/expired",
                headers={
                    "X-Cron-Secret": settings.cron_secret.get_secret_value(),
                },
            )
            assert cleanup.status_code == 200
            assert cleanup.json() == {"deleted_sessions": 2}

            openapi = await client.get("/openapi.json")
            assert "/internal/cleanup/expired" not in openapi.json()["paths"]

        async with async_session_factory() as db:
            for session_id in expired_session_ids:
                assert await SessionRepository(db).get_by_id(session_id) is None
                assert await CategoryRepository(db).count_by_session(session_id) == 0
            assert active_session_id is not None
            assert await SessionRepository(db).get_by_id(active_session_id) is not None
            assert await CategoryRepository(db).count_by_session(active_session_id) == 4
    finally:
        if active_session_id is not None:
            async with async_session_factory() as db:
                await db.execute(delete(Session).where(Session.id == active_session_id))
                await db.commit()
