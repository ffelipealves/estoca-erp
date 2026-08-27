from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import AuthenticationError
from app.models.session import Session
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
