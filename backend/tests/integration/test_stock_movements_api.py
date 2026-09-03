from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
from app.services.seed_service import DEMO_PASSWORD


async def test_stock_movement_api_supports_roles_pagination_and_isolation() -> None:
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
            admin_login = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "admin@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_login = await client_a.post(
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
            operator_id = operator_login.json()["user"]["id"]

            products = await client_a.get(
                "/api/v1/products",
                headers=operator_headers,
            )
            product_id = products.json()[0]["id"]
            initial_quantity = products.json()[0]["quantity"]

            unauthenticated_list = await client_a.get("/api/v1/stock-movements")
            unauthenticated_create = await client_a.post(
                "/api/v1/stock-movements",
                json={
                    "product_id": product_id,
                    "type": "entrada",
                    "quantity": 5,
                },
            )
            assert unauthenticated_list.status_code == 401
            assert unauthenticated_create.status_code == 401

            entrance = await client_a.post(
                "/api/v1/stock-movements",
                headers=operator_headers,
                json={
                    "product_id": product_id,
                    "type": "entrada",
                    "quantity": 5,
                    "note": "  Entrada pelo operador  ",
                },
            )
            assert entrance.status_code == 201
            assert entrance.json()["resulting_quantity"] == initial_quantity + 5
            assert entrance.json()["performed_by_user_id"] == operator_id
            assert entrance.json()["note"] == "Entrada pelo operador"

            insufficient = await client_a.post(
                "/api/v1/stock-movements",
                headers=operator_headers,
                json={
                    "product_id": product_id,
                    "type": "saida",
                    "quantity": initial_quantity + 6,
                },
            )
            assert insufficient.status_code == 422
            assert insufficient.json() == {
                "detail": "Saldo insuficiente para esta saída",
                "code": "business_rule_error",
            }

            forged_server_fields = await client_a.post(
                "/api/v1/stock-movements",
                headers=operator_headers,
                json={
                    "product_id": product_id,
                    "type": "entrada",
                    "quantity": 1,
                    "resulting_quantity": 999,
                    "created_at": "2020-01-01T00:00:00Z",
                },
            )
            assert forged_server_fields.status_code == 422

            adjustment = await client_a.post(
                "/api/v1/stock-movements",
                headers=admin_headers,
                json={
                    "product_id": product_id,
                    "type": "ajuste",
                    "quantity": 2,
                },
            )
            assert adjustment.status_code == 201
            assert adjustment.json()["resulting_quantity"] == 2

            first_page = await client_a.get(
                "/api/v1/stock-movements",
                headers=operator_headers,
                params={"page": 1, "page_size": 1},
            )
            second_page = await client_a.get(
                "/api/v1/stock-movements",
                headers=operator_headers,
                params={"page": 2, "page_size": 1},
            )
            assert first_page.status_code == 200
            assert first_page.json()["total"] == 25
            assert first_page.json()["pages"] == 25
            assert first_page.json()["items"][0]["type"] == "ajuste"
            assert second_page.json()["items"][0]["type"] == "entrada"

            by_product = await client_a.get(
                "/api/v1/stock-movements",
                headers=operator_headers,
                params={"product_id": product_id},
            )
            assert by_product.json()["total"] == 3

            bootstrap_b = await client_b.post("/api/v1/sessions/bootstrap")
            session_b_id = UUID(bootstrap_b.json()["session_id"])
            created_session_ids.append(session_b_id)
            operator_login_b = await client_b.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_headers_b = {
                "Authorization": (f"Bearer {operator_login_b.json()['access_token']}")
            }
            cross_session_create = await client_b.post(
                "/api/v1/stock-movements",
                headers=operator_headers_b,
                json={
                    "product_id": product_id,
                    "type": "entrada",
                    "quantity": 1,
                },
            )
            isolated_list = await client_b.get(
                "/api/v1/stock-movements",
                headers=operator_headers_b,
                params={"product_id": product_id},
            )
            assert cross_session_create.status_code == 404
            assert isolated_list.json()["total"] == 0
            assert isolated_list.json()["items"] == []
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
