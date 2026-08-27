from datetime import UTC, datetime

from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.core.deps import CurrentSession, DbSession, SessionId
from app.schemas.session import SessionBootstrapResponse, SessionInfoResponse
from app.services.seed_service import SeedService
from app.services.session_service import SessionService


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post(
    "/bootstrap",
    response_model=SessionBootstrapResponse,
    status_code=status.HTTP_200_OK,
)
async def bootstrap_session(
    response: Response,
    session_id: SessionId,
    db: DbSession,
) -> SessionBootstrapResponse:
    session_service = SessionService(db)
    resolution = await session_service.resolve_or_create(session_id)

    if resolution.created:
        await SeedService(db).seed_session(resolution.session.id)

    expires_at = session_service.expires_at(resolution.session)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=str(resolution.session.id),
        max_age=settings.session_max_age_hours * 60 * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )
    return SessionBootstrapResponse(
        session_id=resolution.session.id,
        expires_at=expires_at,
    )


@router.get("/me", response_model=SessionInfoResponse)
async def get_session_info(
    current_session: CurrentSession,
    db: DbSession,
) -> SessionInfoResponse:
    session_service = SessionService(db)
    expires_at = session_service.expires_at(current_session)
    ttl_seconds = max(0, int((expires_at - datetime.now(UTC)).total_seconds()))
    return SessionInfoResponse(
        session_id=current_session.id,
        created_at=current_session.created_at,
        last_activity_at=current_session.last_activity_at,
        expires_at=expires_at,
        ttl_seconds=ttl_seconds,
    )
