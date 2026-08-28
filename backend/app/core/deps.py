from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AuthenticationError, AuthorizationError
from app.core.security import decode_access_token
from app.models.demo_user import DemoUser
from app.models.enums import UserRole
from app.models.session import Session
from app.repositories.demo_user_repository import DemoUserRepository
from app.services.session_service import SessionService


DbSession = Annotated[AsyncSession, Depends(get_db)]


async def resolve_session_id(
    request: Request,
    x_session_id: Annotated[str | None, Header(alias="X-Session-Id")] = None,
) -> UUID | None:
    cookie_session_id = request.cookies.get(settings.session_cookie_name)

    for candidate in (x_session_id, cookie_session_id):
        if candidate is None:
            continue
        try:
            return UUID(candidate)
        except ValueError:
            continue

    return None


SessionId = Annotated[UUID | None, Depends(resolve_session_id)]


async def get_current_session(
    session_id: SessionId,
    db: DbSession,
) -> Session:
    session = await SessionService(db).resolve_existing(session_id)
    if session is None:
        raise AuthenticationError("Sessão ausente, inválida ou expirada")
    return session


CurrentSession = Annotated[Session, Depends(get_current_session)]

bearer_scheme = HTTPBearer(auto_error=False)
BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(bearer_scheme),
]


async def get_current_user(
    credentials: BearerCredentials,
    current_session: CurrentSession,
    db: DbSession,
) -> DemoUser:
    if credentials is None:
        raise AuthenticationError("Token de acesso ausente")

    payload = decode_access_token(credentials.credentials)
    if payload.session_id != current_session.id:
        raise AuthenticationError("Token não pertence à sessão atual")

    user = await DemoUserRepository(db).get_by_id(
        current_session.id,
        payload.user_id,
    )
    if user is None or user.role != payload.role:
        raise AuthenticationError("Usuário do token não é mais válido")

    return user


CurrentUser = Annotated[DemoUser, Depends(get_current_user)]


def require_role(
    *allowed_roles: UserRole,
) -> Callable[[DemoUser], Awaitable[DemoUser]]:
    async def role_dependency(current_user: CurrentUser) -> DemoUser:
        if current_user.role not in allowed_roles:
            raise AuthorizationError()
        return current_user

    return role_dependency


AdminUser = Annotated[DemoUser, Depends(require_role(UserRole.admin))]
