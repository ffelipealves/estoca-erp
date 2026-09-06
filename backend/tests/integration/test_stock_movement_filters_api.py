from datetime import UTC, datetime, timedelta
from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
from app.services.seed_service import DEMO_PASSWORD


async def test_stock_movement_list_filters_by_type_and_period() -> None:
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

            products = await client.get("/api/v1/products", headers=headers)
            product = products.json()[0]

            async def total_of(movement_type: str) -> int:
                response = await client.get(
                    "/api/v1/stock-movements",
                    headers=headers,
                    params={"type": movement_type},
                )
                assert response.status_code == 200
                assert all(
                    item["type"] == movement_type for item in response.json()["items"]
                )
                return int(response.json()["total"])

            # A linha de base vem do próprio seed em vez de um número fixo, para
            # o teste não quebrar quando o catálogo inicial mudar.
            baseline = {
                movement_type: await total_of(movement_type)
                for movement_type in ("entrada", "saida", "ajuste")
            }

            before_new_movements = datetime.now(UTC)

            for movement in (
                {"type": "entrada", "quantity": 7},
                {"type": "saida", "quantity": 2},
                {"type": "ajuste", "quantity": 4},
            ):
                created = await client.post(
                    "/api/v1/stock-movements",
                    headers=headers,
                    json={"product_id": product["id"], **movement},
                )
                assert created.status_code == 201

            unfiltered = await client.get("/api/v1/stock-movements", headers=headers)
            total = unfiltered.json()["total"]

            # Cada tipo cresce exatamente um: o filtro separa os três.
            for movement_type, previous in baseline.items():
                assert await total_of(movement_type) == previous + 1

            assert sum(baseline.values()) + 3 == total

            # Período: as três movimentações acima são posteriores ao marcador.
            recent = await client.get(
                "/api/v1/stock-movements",
                headers=headers,
                params={"date_from": before_new_movements.isoformat()},
            )
            assert recent.json()["total"] == 3

            # Uma janela inteiramente no passado não devolve nada.
            past = await client.get(
                "/api/v1/stock-movements",
                headers=headers,
                params={
                    "date_from": (before_new_movements - timedelta(days=2)).isoformat(),
                    "date_to": (before_new_movements - timedelta(days=1)).isoformat(),
                },
            )
            assert past.json()["total"] == 0
            assert past.json()["items"] == []

            # Tipo e período combinam entre si e com o filtro de produto.
            combined = await client.get(
                "/api/v1/stock-movements",
                headers=headers,
                params={
                    "type": "saida",
                    "date_from": before_new_movements.isoformat(),
                    "product_id": product["id"],
                },
            )
            assert combined.json()["total"] == 1
            assert combined.json()["items"][0]["type"] == "saida"

            inverted_range = await client.get(
                "/api/v1/stock-movements",
                headers=headers,
                params={
                    "date_from": before_new_movements.isoformat(),
                    "date_to": (before_new_movements - timedelta(days=1)).isoformat(),
                },
            )
            assert inverted_range.status_code == 422
            assert inverted_range.json() == {
                "detail": "A data inicial não pode ser maior que a final",
                "code": "business_rule_error",
            }

            unknown_type = await client.get(
                "/api/v1/stock-movements",
                headers=headers,
                params={"type": "devolucao"},
            )
            assert unknown_type.status_code == 422
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_stock_movement_period_filter_is_isolated_per_session() -> None:
    """Um filtro amplo não pode vazar movimentações de outra sandbox."""
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

            login_b = await client_b.post(
                "/api/v1/auth/login",
                json={"email": "operador@estoca.demo", "password": DEMO_PASSWORD},
            )
            headers_b = {"Authorization": f"Bearer {login_b.json()['access_token']}"}

            wide_open = await client_b.get(
                "/api/v1/stock-movements",
                headers=headers_b,
                params={
                    "date_from": (datetime.now(UTC) - timedelta(days=365)).isoformat(),
                    "date_to": (datetime.now(UTC) + timedelta(days=365)).isoformat(),
                    "page_size": 100,
                },
            )
            assert wide_open.status_code == 200
            # Só o seed da própria sessão, nunca o da sessão A.
            assert wide_open.json()["total"] == 23
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
