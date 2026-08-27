from uuid import UUID

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.core.security import decode_access_token
from app.main import app
from app.models.enums import UserRole
from app.models.session import Session
from app.services.seed_service import DEMO_PASSWORD


async def test_login_works_for_both_demo_users_in_current_session() -> None:
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
                json={"email": " ADMIN@ESTOCA.DEMO ", "password": DEMO_PASSWORD},
            )
            operator_login = await client.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )

            assert admin_login.status_code == 200
            assert operator_login.status_code == 200
            assert admin_login.json()["user"]["role"] == "admin"
            assert operator_login.json()["user"]["role"] == "operador"

            admin_payload = decode_access_token(admin_login.json()["access_token"])
            operator_payload = decode_access_token(
                operator_login.json()["access_token"]
            )
            assert admin_payload.session_id == session_id
            assert operator_payload.session_id == session_id
            assert admin_payload.role is UserRole.admin
            assert operator_payload.role is UserRole.operador
    finally:
        if session_id is not None:
            async with async_session_factory() as db:
                await db.execute(delete(Session).where(Session.id == session_id))
                await db.commit()


async def test_login_rejects_invalid_credentials() -> None:
    transport = ASGITransport(app=app)
    session_id: UUID | None = None

    try:
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as client:
            bootstrap = await client.post("/api/v1/sessions/bootstrap")
            session_id = UUID(bootstrap.json()["session_id"])

            wrong_password = await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@estoca.demo", "password": "incorreta"},
            )
            unknown_user = await client.post(
                "/api/v1/auth/login",
                json={"email": "inexistente@estoca.demo", "password": "incorreta"},
            )

            expected_error = {
                "detail": "Email ou senha inválidos",
                "code": "authentication_error",
            }
            assert wrong_password.status_code == 401
            assert unknown_user.status_code == 401
            assert wrong_password.json() == expected_error
            assert unknown_user.json() == expected_error
    finally:
        if session_id is not None:
            async with async_session_factory() as db:
                await db.execute(delete(Session).where(Session.id == session_id))
                await db.commit()
