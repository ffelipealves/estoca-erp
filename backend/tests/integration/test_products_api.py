from decimal import Decimal
from uuid import UUID, uuid4

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.enums import StockMovementType
from app.models.product import Product
from app.models.session import Session
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import DEMO_PASSWORD


async def bootstrap_and_login(client: AsyncClient) -> tuple[UUID, dict[str, str]]:
    bootstrap = await client.post("/api/v1/sessions/bootstrap")
    session_id = UUID(bootstrap.json()["session_id"])
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "operador@estoca.demo",
            "password": DEMO_PASSWORD,
        },
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return session_id, headers


async def test_product_reads_filter_and_isolate_sessions() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            session_a_id, headers_a = await bootstrap_and_login(client_a)
            session_b_id, headers_b = await bootstrap_and_login(client_b)
            created_session_ids.extend((session_a_id, session_b_id))

            unauthenticated = await client_a.get("/api/v1/products")
            assert unauthenticated.status_code == 401

            product_list = await client_a.get(
                "/api/v1/products",
                headers=headers_a,
            )
            assert product_list.status_code == 200
            assert len(product_list.json()) == 8
            assert [item["sku"] for item in product_list.json()] == sorted(
                item["sku"] for item in product_list.json()
            )

            product_id = UUID(product_list.json()[0]["id"])
            detail = await client_a.get(
                f"/api/v1/products/{product_id}",
                headers=headers_a,
            )
            assert detail.status_code == 200
            assert detail.json()["id"] == str(product_id)

            search = await client_a.get(
                "/api/v1/products",
                headers=headers_a,
                params={"search": "mouse"},
            )
            assert [item["sku"] for item in search.json()] == ["MS-001"]

            categories = await client_a.get(
                "/api/v1/categories",
                headers=headers_a,
            )
            electronics_id = next(
                item["id"]
                for item in categories.json()
                if item["name"] == "Eletrônicos"
            )
            by_category = await client_a.get(
                "/api/v1/products",
                headers=headers_a,
                params={"category_id": electronics_id},
            )
            assert len(by_category.json()) == 3
            assert {item["category_id"] for item in by_category.json()} == {
                electronics_id
            }

            low_stock = await client_a.get(
                "/api/v1/products",
                headers=headers_a,
                params={"low_stock": "true"},
            )
            regular_stock = await client_a.get(
                "/api/v1/products",
                headers=headers_a,
                params={"low_stock": "false"},
            )
            assert len(low_stock.json()) == 8
            assert regular_stock.json() == []

            cross_session_detail = await client_b.get(
                f"/api/v1/products/{product_id}",
                headers=headers_b,
            )
            assert cross_session_detail.status_code == 404
            assert cross_session_detail.json() == {
                "detail": "Produto não encontrado",
                "code": "not_found",
            }
            cross_session_filter = await client_b.get(
                "/api/v1/products",
                headers=headers_b,
                params={"category_id": electronics_id},
            )
            assert cross_session_filter.json() == []
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_product_create_enforces_rbac_sku_limit_and_initial_stock() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            bootstrap_a = await client_a.post("/api/v1/sessions/bootstrap")
            session_a_id = UUID(bootstrap_a.json()["session_id"])
            created_session_ids.append(session_a_id)
            admin_login_a = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_login_a = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            admin_headers_a = {
                "Authorization": f"Bearer {admin_login_a.json()['access_token']}"
            }
            operator_headers_a = {
                "Authorization": (
                    f"Bearer {operator_login_a.json()['access_token']}"
                )
            }
            admin_user_id = UUID(admin_login_a.json()["user"]["id"])

            categories = await client_a.get(
                "/api/v1/categories",
                headers=admin_headers_a,
            )
            category_id = UUID(categories.json()[0]["id"])
            payload = {
                "category_id": str(category_id),
                "name": "  Água mineral  ",
                "sku": "  ag-001  ",
                "price": "3.75",
                "initial_quantity": 7,
                "low_stock_threshold": 3,
            }

            forbidden = await client_a.post(
                "/api/v1/products",
                headers=operator_headers_a,
                json=payload,
            )
            assert forbidden.status_code == 403

            invalid_category = await client_a.post(
                "/api/v1/products",
                headers=admin_headers_a,
                json={**payload, "category_id": str(uuid4())},
            )
            assert invalid_category.status_code == 404

            invalid_quantity = await client_a.post(
                "/api/v1/products",
                headers=admin_headers_a,
                json={**payload, "initial_quantity": -1},
            )
            assert invalid_quantity.status_code == 422

            created = await client_a.post(
                "/api/v1/products",
                headers=admin_headers_a,
                json=payload,
            )
            assert created.status_code == 201
            assert created.json()["name"] == "Água mineral"
            assert created.json()["sku"] == "AG-001"
            assert created.json()["price"] == "3.75"
            assert created.json()["quantity"] == 7
            product_id = UUID(created.json()["id"])

            async with async_session_factory() as db:
                movements = await StockMovementRepository(db).list_by_product(
                    session_a_id,
                    product_id,
                )
                assert len(movements) == 1
                assert movements[0].type is StockMovementType.entrada
                assert movements[0].quantity == 7
                assert movements[0].resulting_quantity == 7
                assert movements[0].performed_by_user_id == admin_user_id
                assert movements[0].note == "Estoque inicial"

            duplicate = await client_a.post(
                "/api/v1/products",
                headers=admin_headers_a,
                json={**payload, "sku": " AG-001 "},
            )
            assert duplicate.status_code == 409
            assert duplicate.json() == {
                "detail": "Já existe um produto com este SKU",
                "code": "conflict",
            }

            bootstrap_b = await client_b.post("/api/v1/sessions/bootstrap")
            session_b_id = UUID(bootstrap_b.json()["session_id"])
            created_session_ids.append(session_b_id)
            admin_login_b = await client_b.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            admin_headers_b = {
                "Authorization": f"Bearer {admin_login_b.json()['access_token']}"
            }
            categories_b = await client_b.get(
                "/api/v1/categories",
                headers=admin_headers_b,
            )
            same_sku_other_session = await client_b.post(
                "/api/v1/products",
                headers=admin_headers_b,
                json={
                    **payload,
                    "category_id": categories_b.json()[0]["id"],
                    "initial_quantity": 0,
                },
            )
            assert same_sku_other_session.status_code == 201

            async with async_session_factory() as db:
                products = [
                    Product(
                        session_id=session_a_id,
                        category_id=category_id,
                        name=f"Produto limite {index}",
                        sku=f"LIMIT-{index:03d}",
                        price=Decimal("1.00"),
                    )
                    for index in range(41)
                ]
                await ProductRepository(db).create_many(products)
                await db.commit()
                assert (
                    await ProductRepository(db).count_by_session(session_a_id)
                    == 50
                )

            over_limit = await client_a.post(
                "/api/v1/products",
                headers=admin_headers_a,
                json={**payload, "sku": "OVER-050"},
            )
            assert over_limit.status_code == 422
            assert over_limit.json() == {
                "detail": "Limite de 50 produtos por sessão atingido",
                "code": "limit_exceeded",
            }
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_product_update_and_delete_preserve_stock_rules_and_isolation() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            bootstrap_a = await client_a.post("/api/v1/sessions/bootstrap")
            session_a_id = UUID(bootstrap_a.json()["session_id"])
            created_session_ids.append(session_a_id)
            admin_login_a = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_login_a = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            admin_headers_a = {
                "Authorization": f"Bearer {admin_login_a.json()['access_token']}"
            }
            operator_headers_a = {
                "Authorization": (
                    f"Bearer {operator_login_a.json()['access_token']}"
                )
            }

            categories_a = await client_a.get(
                "/api/v1/categories",
                headers=admin_headers_a,
            )
            source_category_id = categories_a.json()[0]["id"]
            target_category_id = categories_a.json()[1]["id"]
            existing_products = await client_a.get(
                "/api/v1/products",
                headers=admin_headers_a,
            )
            existing_sku = existing_products.json()[0]["sku"]

            created = await client_a.post(
                "/api/v1/products",
                headers=admin_headers_a,
                json={
                    "category_id": source_category_id,
                    "name": "Produto editável",
                    "sku": "EDIT-001",
                    "price": "10.00",
                    "initial_quantity": 4,
                    "low_stock_threshold": 2,
                },
            )
            product_id = UUID(created.json()["id"])
            update_payload = {
                "category_id": target_category_id,
                "name": "  Produto atualizado  ",
                "sku": " edit-002 ",
                "price": "12.50",
                "low_stock_threshold": 6,
            }

            forbidden_update = await client_a.put(
                f"/api/v1/products/{product_id}",
                headers=operator_headers_a,
                json=update_payload,
            )
            assert forbidden_update.status_code == 403

            direct_quantity = await client_a.put(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
                json={**update_payload, "quantity": 999},
            )
            assert direct_quantity.status_code == 422

            direct_initial_quantity = await client_a.put(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
                json={**update_payload, "initial_quantity": 999},
            )
            assert direct_initial_quantity.status_code == 422

            invalid_category = await client_a.put(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
                json={**update_payload, "category_id": str(uuid4())},
            )
            assert invalid_category.status_code == 404

            duplicate_sku = await client_a.put(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
                json={**update_payload, "sku": existing_sku},
            )
            assert duplicate_sku.status_code == 409

            bootstrap_b = await client_b.post("/api/v1/sessions/bootstrap")
            session_b_id = UUID(bootstrap_b.json()["session_id"])
            created_session_ids.append(session_b_id)
            admin_login_b = await client_b.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            admin_headers_b = {
                "Authorization": f"Bearer {admin_login_b.json()['access_token']}"
            }
            cross_session = await client_b.delete(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_b,
            )
            assert cross_session.status_code == 404

            updated = await client_a.put(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
                json=update_payload,
            )
            assert updated.status_code == 200
            assert updated.json()["category_id"] == target_category_id
            assert updated.json()["name"] == "Produto atualizado"
            assert updated.json()["sku"] == "EDIT-002"
            assert updated.json()["price"] == "12.50"
            assert updated.json()["quantity"] == 4
            assert updated.json()["low_stock_threshold"] == 6

            async with async_session_factory() as db:
                movements = await StockMovementRepository(db).list_by_product(
                    session_a_id,
                    product_id,
                )
                assert len(movements) == 1
                assert movements[0].resulting_quantity == 4

            forbidden_delete = await client_a.delete(
                f"/api/v1/products/{product_id}",
                headers=operator_headers_a,
            )
            assert forbidden_delete.status_code == 403

            deleted = await client_a.delete(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
            )
            assert deleted.status_code == 204
            assert deleted.content == b""

            missing = await client_a.get(
                f"/api/v1/products/{product_id}",
                headers=admin_headers_a,
            )
            assert missing.status_code == 404
            async with async_session_factory() as db:
                assert (
                    await StockMovementRepository(db).list_by_product(
                        session_a_id,
                        product_id,
                    )
                    == []
                )
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
