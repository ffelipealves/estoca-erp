from datetime import UTC, datetime

from app.core.database import async_session_factory
from app.core.security import verify_password
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import (
    DEMO_PASSWORD,
    SEED_TIMEZONE,
    SeedService,
    history_start,
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
        # Saldo final do seed depois do histórico; um produto termina zerado.
        assert sum(product.quantity for product in products) == 719
        assert await StockMovementRepository(db).count_by_session(session.id) == 39
        seeded_items = [*categories, *products, *users]
        assert all(item.session_id == session.id for item in seeded_items)
        assert {user.email for user in users} == {
            "admin@estoca.demo",
            "operador@estoca.demo",
        }
        assert all(verify_password(DEMO_PASSWORD, user.password_hash) for user in users)

        await db.rollback()


async def test_seed_history_follows_the_demo_calendar() -> None:
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

        assert total == 39
        stamps = sorted(movement.created_at for movement in movements)

        # O estoque inicial é um instante só; dali em diante, cada movimentação
        # tem o seu carimbo, e nenhum produto tem dois eventos no mesmo instante.
        initial_stamps = {
            m.created_at for m in movements if m.note == "Estoque inicial"
        }
        assert len(initial_stamps) == 1
        assert len(set(stamps)) == total - 15
        per_product = [(m.product_id, m.created_at) for m in movements]
        assert len(set(per_product)) == total

        # A janela vai da meia-noite de 14 dias atrás até a véspera, no horário
        # de Brasília: nada fica no futuro nem no dia de hoje.
        now = datetime.now(UTC)
        start = history_start(now)
        today = now.astimezone(SEED_TIMEZONE).date()
        assert stamps[0] == start
        assert stamps[-1] < now
        assert stamps[-1].astimezone(SEED_TIMEZONE).date() < today

        # O estoque inicial precede as movimentações do dia a dia, senão a série
        # começaria com saídas de um saldo que ainda não existe.
        initial = [m for m in movements if m.note == "Estoque inicial"]
        daily = [m for m in movements if m.note != "Estoque inicial"]
        assert len(initial) == 16
        assert len(daily) == 23
        assert max(m.created_at for m in initial) < min(m.created_at for m in daily)

        await db.rollback()


async def test_seed_leaves_a_low_stock_queue_by_urgency() -> None:
    """O Painel abre com uma fila de reposição que mostra as três urgências."""
    async with async_session_factory() as db:
        session = (await SessionService(db).resolve_or_create(None)).session
        await SeedService(db).seed_session(session.id)

        products = await ProductRepository(db).list_by_session(session.id)
        low_stock = {
            product.sku: product.quantity
            for product in products
            if product.quantity <= product.low_stock_threshold
        }

        assert low_stock == {
            "HID-3134": 0,
            "ELE-2132": 3,
            "FIX-4032": 6,
            "FER-1305": 4,
            "FER-1208": 5,
        }

        await db.rollback()


async def test_seed_history_chains_previous_and_resulting_balances() -> None:
    """Cada movimentação parte do saldo em que a anterior do produto parou."""
    async with async_session_factory() as db:
        session = (await SessionService(db).resolve_or_create(None)).session
        await SeedService(db).seed_session(session.id)

        products = await ProductRepository(db).list_by_session(session.id)
        repository = StockMovementRepository(db)
        for product in products:
            history = await repository.list_by_product(session.id, product.id)
            assert history[0].previous_quantity == 0
            for before, after in zip(history, history[1:], strict=False):
                assert after.previous_quantity == before.resulting_quantity
            assert history[-1].resulting_quantity == product.quantity

        await db.rollback()
