from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.enums import StockMovementType
from app.models.session import Session
from app.models.stock_movement import StockMovement
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import DEMO_PASSWORD


async def test_reset_is_admin_only_and_preserves_session_and_users() -> None:
    transport = ASGITransport(app=app)
    session_id: UUID | None = None

    try:
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            bootstrap = await client.post("/api/v1/sessions/bootstrap")
            session_id = UUID(bootstrap.json()["session_id"])

            admin_login = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_login = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            admin_headers = {
                "Authorization": f"Bearer {admin_login.json()['access_token']}"
            }
            operator_headers = {
                "Authorization": f"Bearer {operator_login.json()['access_token']}"
            }

            async with async_session_factory() as db:
                categories_before = await CategoryRepository(db).list_by_session(
                    session_id
                )
                products_before = await ProductRepository(db).list_by_session(
                    session_id
                )
                users_before = await DemoUserRepository(db).list_by_session(
                    session_id
                )
                db.add(
                    StockMovement(
                        session_id=session_id,
                        product_id=products_before[0].id,
                        performed_by_user_id=users_before[0].id,
                        type=StockMovementType.ajuste,
                        quantity=0,
                        resulting_quantity=0,
                        note="Movimentação criada para testar o reset",
                    )
                )
                await db.commit()

            forbidden = await client.post(
                "/api/v1/sessions/me/reset",
                headers=operator_headers,
            )
            assert forbidden.status_code == 403

            async with async_session_factory() as db:
                assert (
                    await StockMovementRepository(db).count_by_session(session_id)
                    == 1
                )

            reset = await client.post(
                "/api/v1/sessions/me/reset",
                headers=admin_headers,
            )
            assert reset.status_code == 200
            assert reset.json() == {
                "session_id": str(session_id),
                "categories_seeded": 4,
                "products_seeded": 8,
            }

            async with async_session_factory() as db:
                categories_after = await CategoryRepository(db).list_by_session(
                    session_id
                )
                products_after = await ProductRepository(db).list_by_session(
                    session_id
                )
                users_after = await DemoUserRepository(db).list_by_session(
                    session_id
                )
                movement_count = await StockMovementRepository(db).count_by_session(
                    session_id
                )

            assert len(categories_after) == 4
            assert len(products_after) == 8
            assert movement_count == 0
            assert {item.id for item in categories_before}.isdisjoint(
                item.id for item in categories_after
            )
            assert {item.id for item in products_before}.isdisjoint(
                item.id for item in products_after
            )
            assert {item.id for item in users_after} == {
                item.id for item in users_before
            }

            repeated = await client.post(
                "/api/v1/sessions/me/reset",
                headers=admin_headers,
            )
            assert repeated.status_code == 200
            assert UUID(repeated.json()["session_id"]) == session_id
    finally:
        if session_id is not None:
            async with async_session_factory() as db:
                await db.execute(delete(Session).where(Session.id == session_id))
                await db.commit()
