import json
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.config import settings
from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository


async def test_bootstrap_is_idempotent_and_isolates_two_clients() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            response_a = await client_a.post("/api/v1/sessions/bootstrap")
            response_b = await client_b.post("/api/v1/sessions/bootstrap")

            assert response_a.status_code == 200
            assert response_b.status_code == 200

            session_a = UUID(response_a.json()["session_id"])
            session_b = UUID(response_b.json()["session_id"])
            created_session_ids.extend((session_a, session_b))

            assert session_a != session_b
            assert "HttpOnly" in response_a.headers["set-cookie"]

            repeated_a = await client_a.post("/api/v1/sessions/bootstrap")
            assert repeated_a.status_code == 200
            assert UUID(repeated_a.json()["session_id"]) == session_a

        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as header_client:
            header_response = await header_client.post(
                "/api/v1/sessions/bootstrap",
                headers={"X-Session-Id": str(session_a)},
            )
            session_info = await header_client.get(
                "/api/v1/sessions/me",
                headers={"X-Session-Id": str(session_a)},
            )

            assert header_response.status_code == 200
            assert UUID(header_response.json()["session_id"]) == session_a
            assert session_info.status_code == 200
            assert UUID(session_info.json()["session_id"]) == session_a
            assert session_info.json()["ttl_seconds"] > 0

        async with async_session_factory() as db:
            category_repository = CategoryRepository(db)
            product_repository = ProductRepository(db)
            user_repository = DemoUserRepository(db)

            categories_a = await category_repository.list_by_session(session_a)
            categories_b = await category_repository.list_by_session(session_b)
            products_a = await product_repository.list_by_session(session_a)
            products_b = await product_repository.list_by_session(session_b)
            users_a = await user_repository.list_by_session(session_a)
            users_b = await user_repository.list_by_session(session_b)

            assert len(categories_a) == len(categories_b) == 4
            assert len(products_a) == len(products_b) == 16
            assert len(users_a) == len(users_b) == 2
            assert {item.id for item in categories_a}.isdisjoint(
                item.id for item in categories_b
            )
            assert {item.id for item in products_a}.isdisjoint(
                item.id for item in products_b
            )
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_session_info_exposes_the_expiry_rule() -> None:
    """O cliente renova a contagem regressiva sem repetir a configuração."""
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            bootstrap = await client.post("/api/v1/sessions/bootstrap")
            created_session_ids.append(UUID(bootstrap.json()["session_id"]))

            response = await client.get("/api/v1/sessions/me")
            assert response.status_code == 200
            info = response.json()

            created_at = datetime.fromisoformat(info["created_at"])
            last_activity_at = datetime.fromisoformat(info["last_activity_at"])
            expires_at = datetime.fromisoformat(info["expires_at"])
            max_expires_at = datetime.fromisoformat(info["max_expires_at"])
            inactivity = timedelta(seconds=info["inactivity_seconds"])

            assert inactivity == timedelta(minutes=settings.session_inactivity_minutes)
            assert max_expires_at == created_at + timedelta(
                hours=settings.session_max_age_hours
            )
            assert expires_at == min(last_activity_at + inactivity, max_expires_at)
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_bootstrap_commits_before_the_response_is_sent() -> None:
    """O frontend encadeia /sessions/me assim que recebe o bootstrap. Se o
    commit viesse depois da resposta, a chamada seguinte não veria a sessão."""
    committed: list[bool] = []
    session_ids: list[UUID] = []

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, Any]) -> None:
        if message["type"] != "http.response.body" or not message.get("body"):
            return
        session_id = UUID(json.loads(message["body"])["session_id"])
        session_ids.append(session_id)
        # Outra conexão, como a próxima requisição do cliente.
        async with async_session_factory() as db:
            committed.append(await db.get(Session, session_id) is not None)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/v1/sessions/bootstrap",
        "raw_path": b"/api/v1/sessions/bootstrap",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"host", b"test")],
        "client": ("127.0.0.1", 50000),
        "server": ("test", 80),
    }

    try:
        await app(scope, receive, send)
        assert committed == [True]
    finally:
        if session_ids:
            async with async_session_factory() as db:
                await db.execute(delete(Session).where(Session.id.in_(session_ids)))
                await db.commit()


async def test_session_info_requires_valid_session() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/v1/sessions/me")

    assert response.status_code == 401
    assert response.json() == {
        "detail": "Sessão ausente, inválida ou expirada",
        "code": "authentication_error",
    }
