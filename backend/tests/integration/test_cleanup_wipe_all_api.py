from datetime import UTC, datetime

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import async_session_factory
from app.main import app
from app.models.enums import StockMovementType
from app.models.session import Session
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.session_repository import SessionRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import SeedService
from app.services.stock_movement_service import StockMovementService


async def test_wipe_all_requires_secret_and_cascades_every_session() -> None:
    created_session_ids = []

    async with async_session_factory() as db:
        sessions = SessionRepository(db)
        for _ in range(2):
            session = await sessions.create(datetime.now(UTC))
            created_session_ids.append(session.id)
            await SeedService(db).seed_session(session.id)
            product = (await ProductRepository(db).list_by_session(session.id))[0]
            user = (await DemoUserRepository(db).list_by_session(session.id))[0]
            await StockMovementService(db).create(
                session_id=session.id,
                product_id=product.id,
                performed_by_user_id=user.id,
                movement_type=StockMovementType.entrada,
                quantity=1,
            )
        await db.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            wrong_secret = await client.post(
                "/internal/cleanup/wipe-all",
                headers={"X-Cron-Secret": "segredo-incorreto"},
            )
            assert wrong_secret.status_code == 403

            async with async_session_factory() as db:
                for session_id in created_session_ids:
                    assert await SessionRepository(db).get_by_id(session_id) is not None

            wipe = await client.post(
                "/internal/cleanup/wipe-all",
                headers={
                    "X-Cron-Secret": settings.cron_secret.get_secret_value(),
                },
            )
            assert wipe.status_code == 200
            assert wipe.json() == {"deleted_sessions": 2}

            repeated_wipe = await client.post(
                "/internal/cleanup/wipe-all",
                headers={
                    "X-Cron-Secret": settings.cron_secret.get_secret_value(),
                },
            )
            assert repeated_wipe.status_code == 200
            assert repeated_wipe.json() == {"deleted_sessions": 0}

        async with async_session_factory() as db:
            for session_id in created_session_ids:
                assert await SessionRepository(db).get_by_id(session_id) is None
                assert await CategoryRepository(db).count_by_session(session_id) == 0
                assert await ProductRepository(db).count_by_session(session_id) == 0
                assert await DemoUserRepository(db).count_by_session(session_id) == 0
                assert (
                    await StockMovementRepository(db).count_by_session(session_id) == 0
                )
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
