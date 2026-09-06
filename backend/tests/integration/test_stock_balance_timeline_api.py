from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
from app.services.seed_service import DEMO_PASSWORD


async def test_balance_timeline_tracks_total_stock_over_time() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            bootstrap = await client.post("/api/v1/sessions/bootstrap")
            created_session_ids.append(UUID(bootstrap.json()["session_id"]))

            login = await client.post(
                "/api/v1/auth/login",
                json={"email": "operador@estoca.demo", "password": DEMO_PASSWORD},
            )
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

            unauthenticated = await client.get(
                "/api/v1/stock-movements/balance-timeline"
            )
            assert unauthenticated.status_code == 401

            products = await client.get("/api/v1/products", headers=headers)
            units_now = sum(item["quantity"] for item in products.json())

            timeline = await client.get(
                "/api/v1/stock-movements/balance-timeline",
                headers=headers,
            )
            assert timeline.status_code == 200
            points = timeline.json()["points"]

            # Um ponto por movimentação do seed, em ordem cronológica.
            assert len(points) == 23
            stamps = [point["at"] for point in points]
            assert stamps == sorted(stamps)

            # O ponto final é o saldo real do catálogo: a série e a tabela de
            # produtos precisam contar a mesma história.
            assert points[-1]["total_quantity"] == units_now

            # O estoque só cresce enquanto o seed registra os saldos iniciais.
            opening = [p["total_quantity"] for p in points[:16]]
            assert opening == sorted(opening)
            assert points[0]["total_quantity"] > 0

            # Uma entrada nova move o último ponto exatamente pelo seu tamanho.
            product = products.json()[0]
            created = await client.post(
                "/api/v1/stock-movements",
                headers=headers,
                json={"product_id": product["id"], "type": "entrada", "quantity": 9},
            )
            assert created.status_code == 201

            after = await client.get(
                "/api/v1/stock-movements/balance-timeline",
                headers=headers,
            )
            after_points = after.json()["points"]
            assert len(after_points) == 24
            assert after_points[-1]["total_quantity"] == units_now + 9

            # Um ajuste é quantidade absoluta: o total move pelo delta, não pelo
            # valor informado.
            adjustment = await client.post(
                "/api/v1/stock-movements",
                headers=headers,
                json={"product_id": product["id"], "type": "ajuste", "quantity": 0},
            )
            assert adjustment.status_code == 201
            adjusted = await client.get(
                "/api/v1/stock-movements/balance-timeline",
                headers=headers,
            )
            expected = (
                units_now
                + 9
                - adjustment.json()["quantity"]
                - (product["quantity"] + 9 - adjustment.json()["resulting_quantity"])
            )
            assert adjusted.json()["points"][-1]["total_quantity"] == expected
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_balance_timeline_is_isolated_per_session() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            for client in (client_a, client_b):
                bootstrap = await client.post("/api/v1/sessions/bootstrap")
                created_session_ids.append(UUID(bootstrap.json()["session_id"]))

            logins = []
            for client in (client_a, client_b):
                login = await client.post(
                    "/api/v1/auth/login",
                    json={"email": "admin@estoca.demo", "password": DEMO_PASSWORD},
                )
                logins.append(
                    {"Authorization": f"Bearer {login.json()['access_token']}"}
                )

            products_a = await client_a.get("/api/v1/products", headers=logins[0])
            await client_a.post(
                "/api/v1/stock-movements",
                headers=logins[0],
                json={
                    "product_id": products_a.json()[0]["id"],
                    "type": "entrada",
                    "quantity": 250,
                },
            )

            timeline_b = await client_b.get(
                "/api/v1/stock-movements/balance-timeline",
                headers=logins[1],
            )
            points_b = timeline_b.json()["points"]

            # A entrada gorda da sessão A não pode aparecer na série da sessão B.
            assert len(points_b) == 23
            products_b = await client_b.get("/api/v1/products", headers=logins[1])
            assert points_b[-1]["total_quantity"] == sum(
                item["quantity"] for item in products_b.json()
            )
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
