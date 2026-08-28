from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
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
