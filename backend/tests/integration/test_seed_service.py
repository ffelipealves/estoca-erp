from app.core.database import async_session_factory
from app.core.security import verify_password
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.services.seed_service import DEMO_PASSWORD, SeedService
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
        assert first_seed.products_created == 8
        assert first_seed.users_created == 2
        assert second_seed.categories_created == 0
        assert second_seed.products_created == 0
        assert second_seed.users_created == 0

        assert len(categories) == 4
        assert len(products) == 8
        assert len(users) == 2
        assert all(product.quantity == 0 for product in products)
        seeded_items = [*categories, *products, *users]
        assert all(item.session_id == session.id for item in seeded_items)
        assert {user.email for user in users} == {
            "admin@estoca.demo",
            "operador@estoca.demo",
        }
        assert all(verify_password(DEMO_PASSWORD, user.password_hash) for user in users)

        await db.rollback()
