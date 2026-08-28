from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.main import app
from app.models.session import Session
from app.services.seed_service import DEMO_PASSWORD


async def bootstrap_and_login(
    client: AsyncClient,
    email: str = "operador@estoca.demo",
) -> tuple[UUID, dict[str, str]]:
    bootstrap = await client.post("/api/v1/sessions/bootstrap")
    session_id = UUID(bootstrap.json()["session_id"])
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": DEMO_PASSWORD,
        },
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return session_id, headers


async def test_category_reads_require_auth_and_are_isolated_by_session() -> None:
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

            unauthenticated = await client_a.get("/api/v1/categories")
            assert unauthenticated.status_code == 401

            category_list = await client_a.get(
                "/api/v1/categories",
                headers=headers_a,
            )
            assert category_list.status_code == 200
            assert [item["name"] for item in category_list.json()] == [
                "Alimentos",
                "Eletrônicos",
                "Escritório",
                "Limpeza",
            ]

            category_id = UUID(category_list.json()[0]["id"])
            detail = await client_a.get(
                f"/api/v1/categories/{category_id}",
                headers=headers_a,
            )
            assert detail.status_code == 200
            assert detail.json()["id"] == str(category_id)
            assert detail.json()["name"] == "Alimentos"

            cross_session = await client_b.get(
                f"/api/v1/categories/{category_id}",
                headers=headers_b,
            )
            assert cross_session.status_code == 404
            assert cross_session.json() == {
                "detail": "Categoria não encontrada",
                "code": "not_found",
            }
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_category_create_and_update_are_admin_only_and_session_scoped() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            session_a_id, admin_headers_a = await bootstrap_and_login(
                client_a,
                "admin@estoca.demo",
            )
            created_session_ids.append(session_a_id)
            operator_login = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_headers = {
                "Authorization": f"Bearer {operator_login.json()['access_token']}"
            }

            forbidden = await client_a.post(
                "/api/v1/categories",
                headers=operator_headers,
                json={"name": "Bebidas"},
            )
            assert forbidden.status_code == 403

            blank_name = await client_a.post(
                "/api/v1/categories",
                headers=admin_headers_a,
                json={"name": "   "},
            )
            assert blank_name.status_code == 422

            created = await client_a.post(
                "/api/v1/categories",
                headers=admin_headers_a,
                json={"name": "  Bebidas  "},
            )
            assert created.status_code == 201
            assert created.json()["name"] == "Bebidas"
            category_id = UUID(created.json()["id"])

            duplicate = await client_a.post(
                "/api/v1/categories",
                headers=admin_headers_a,
                json={"name": "Bebidas"},
            )
            assert duplicate.status_code == 409
            assert duplicate.json() == {
                "detail": "Já existe uma categoria com este nome",
                "code": "conflict",
            }

            updated = await client_a.put(
                f"/api/v1/categories/{category_id}",
                headers=admin_headers_a,
                json={"name": "Bebidas geladas"},
            )
            assert updated.status_code == 200
            assert updated.json()["name"] == "Bebidas geladas"

            duplicate_update = await client_a.put(
                f"/api/v1/categories/{category_id}",
                headers=admin_headers_a,
                json={"name": "Alimentos"},
            )
            assert duplicate_update.status_code == 409

            session_b_id, admin_headers_b = await bootstrap_and_login(
                client_b,
                "admin@estoca.demo",
            )
            created_session_ids.append(session_b_id)
            same_name_other_session = await client_b.post(
                "/api/v1/categories",
                headers=admin_headers_b,
                json={"name": "Bebidas geladas"},
            )
            assert same_name_other_session.status_code == 201
            assert same_name_other_session.json()["name"] == "Bebidas geladas"
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()


async def test_category_delete_blocks_linked_products_and_requires_admin() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            session_a_id, admin_headers_a = await bootstrap_and_login(
                client_a,
                "admin@estoca.demo",
            )
            created_session_ids.append(session_a_id)
            operator_login = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )
            operator_headers = {
                "Authorization": f"Bearer {operator_login.json()['access_token']}"
            }

            categories = await client_a.get(
                "/api/v1/categories",
                headers=admin_headers_a,
            )
            linked_category_id = UUID(categories.json()[0]["id"])
            empty_category = await client_a.post(
                "/api/v1/categories",
                headers=admin_headers_a,
                json={"name": "Sem produtos"},
            )
            empty_category_id = UUID(empty_category.json()["id"])

            forbidden = await client_a.delete(
                f"/api/v1/categories/{empty_category_id}",
                headers=operator_headers,
            )
            assert forbidden.status_code == 403

            linked = await client_a.delete(
                f"/api/v1/categories/{linked_category_id}",
                headers=admin_headers_a,
            )
            assert linked.status_code == 422
            assert linked.json() == {
                "detail": (
                    "Não é possível excluir uma categoria com produtos vinculados"
                ),
                "code": "business_rule_error",
            }

            session_b_id, admin_headers_b = await bootstrap_and_login(
                client_b,
                "admin@estoca.demo",
            )
            created_session_ids.append(session_b_id)
            cross_session = await client_b.delete(
                f"/api/v1/categories/{empty_category_id}",
                headers=admin_headers_b,
            )
            assert cross_session.status_code == 404

            deleted = await client_a.delete(
                f"/api/v1/categories/{empty_category_id}",
                headers=admin_headers_a,
            )
            assert deleted.status_code == 204
            assert deleted.content == b""

            missing = await client_a.get(
                f"/api/v1/categories/{empty_category_id}",
                headers=admin_headers_a,
            )
            assert missing.status_code == 404
            linked_still_exists = await client_a.get(
                f"/api/v1/categories/{linked_category_id}",
                headers=admin_headers_a,
            )
            assert linked_still_exists.status_code == 200
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
