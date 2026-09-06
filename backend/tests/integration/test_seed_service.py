from datetime import UTC, datetime, timedelta

from app.core.database import async_session_factory
from app.core.security import verify_password
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import (
    DEMO_PASSWORD,
    HISTORY_ENDS_BEFORE_NOW,
    HISTORY_WINDOW,
    SeedService,
)
from app.services.session_service import SessionService


async def test_seed_session_creates_isolated_catalog_and_users_once() -> None:
    async with async_session_factory() as db:
        session = (await SessionService(db).resolve_or_create(None)).session
        seed_service = SeedService(db)

        first_seed = await seed_service.seed_session(session.id)
        second_seed = await seed_service.seed_session(session.id)

        categories = await CategoryRepository(db).list_by_session(session.id)
        products = await ProductRepository(db).list_by_session(session.id)
        users = await DemoUserRepository(db).list_by_session(session.id)

        assert first_seed.categories_created == 4
        assert first_seed.products_created == 16
        assert first_seed.users_created == 2
        assert second_seed.categories_created == 0
        assert second_seed.products_created == 0
        assert second_seed.users_created == 0

        assert len(categories) == 4
        assert len(products) == 16
        assert len(users) == 2
        assert all(product.quantity > 0 for product in products)
        assert await StockMovementRepository(db).count_by_session(session.id) == 23
        seeded_items = [*categories, *products, *users]
        assert all(item.session_id == session.id for item in seeded_items)
        assert {user.email for user in users} == {
            "admin@estoca.demo",
            "operador@estoca.demo",
        }
        assert all(verify_password(DEMO_PASSWORD, user.password_hash) for user in users)

        await db.rollback()


async def test_seed_history_is_spread_over_time() -> None:
    """Sem isto o seed inteiro nasce com o carimbo da transação, e tanto a série
    histórica quanto o filtro por período ficam sem o que mostrar."""
    async with async_session_factory() as db:
        session = (await SessionService(db).resolve_or_create(None)).session
        await SeedService(db).seed_session(session.id)

        movements, total = await StockMovementRepository(db).list_paginated(
            session.id,
            offset=0,
            limit=100,
        )

        assert total == 23
        stamps = sorted(movement.created_at for movement in movements)

        # Todo carimbo é distinto: é o que dá forma à linha do tempo.
        assert len(set(stamps)) == total

        now = datetime.now(UTC)
        assert stamps[-1] <= now - HISTORY_ENDS_BEFORE_NOW + timedelta(minutes=1)
        assert stamps[0] >= now - HISTORY_ENDS_BEFORE_NOW - HISTORY_WINDOW - timedelta(
            minutes=1
        )

        # O estoque inicial precede as movimentações do dia a dia, senão a série
        # começaria com saídas de um saldo que ainda não existe.
        initial = [m for m in movements if m.note == "Estoque inicial"]
        daily = [m for m in movements if m.note != "Estoque inicial"]
        assert len(initial) == 16
        assert max(m.created_at for m in initial) < min(m.created_at for m in daily)

        await db.rollback()
