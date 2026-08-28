from uuid import UUID

import pytest
from fastapi.security import HTTPAuthorizationCredentials
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.core.database import async_session_factory
from app.core.deps import get_current_user, require_role
from app.core.errors import AuthenticationError, AuthorizationError
from app.core.security import create_access_token
from app.main import app
from app.models.enums import UserRole
from app.models.session import Session
from app.repositories.session_repository import SessionRepository
from app.services.seed_service import DEMO_PASSWORD


async def test_current_user_and_role_are_bound_to_current_session() -> None:
    transport = ASGITransport(app=app)
    created_session_ids: list[UUID] = []

    try:
        async with (
            AsyncClient(transport=transport, base_url="http://test") as client_a,
            AsyncClient(transport=transport, base_url="http://test") as client_b,
        ):
            bootstrap_a = await client_a.post("/api/v1/sessions/bootstrap")
            bootstrap_b = await client_b.post("/api/v1/sessions/bootstrap")
            session_a_id = UUID(bootstrap_a.json()["session_id"])
            session_b_id = UUID(bootstrap_b.json()["session_id"])
            created_session_ids.extend((session_a_id, session_b_id))

            admin_login = await client_a.post(
                "/api/v1/auth/login",
                json={"email": "admin@estoca.demo", "password": DEMO_PASSWORD},
            )
            operator_login = await client_a.post(
                "/api/v1/auth/login",
                json={
                    "email": "operador@estoca.demo",
                    "password": DEMO_PASSWORD,
                },
            )

        admin_credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=admin_login.json()["access_token"],
        )
        operator_credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=operator_login.json()["access_token"],
        )

        async with async_session_factory() as db:
            session_repository = SessionRepository(db)
            session_a = await session_repository.get_by_id(session_a_id)
            session_b = await session_repository.get_by_id(session_b_id)
            assert session_a is not None
            assert session_b is not None

            admin = await get_current_user(admin_credentials, session_a, db)
            operator = await get_current_user(operator_credentials, session_a, db)

            admin_only = require_role(UserRole.admin)
            assert await admin_only(admin) is admin
            with pytest.raises(AuthorizationError):
                await admin_only(operator)

            with pytest.raises(
                AuthenticationError,
                match="Token não pertence à sessão atual",
            ):
                await get_current_user(admin_credentials, session_b, db)

            role_mismatch_token = create_access_token(
                user_id=admin.id,
                session_id=session_a.id,
                role=UserRole.operador,
            )
            role_mismatch_credentials = HTTPAuthorizationCredentials(
                scheme="Bearer",
                credentials=role_mismatch_token,
            )
            with pytest.raises(
                AuthenticationError,
                match="Usuário do token não é mais válido",
            ):
                await get_current_user(role_mismatch_credentials, session_a, db)
    finally:
        if created_session_ids:
            async with async_session_factory() as db:
                await db.execute(
                    delete(Session).where(Session.id.in_(created_session_ids))
                )
                await db.commit()
