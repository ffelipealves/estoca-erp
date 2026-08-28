from fastapi import APIRouter

from app.core.deps import CronAuthorized, DbSession
from app.schemas.internal import CleanupResponse
from app.services.session_cleanup_service import SessionCleanupService

router = APIRouter(prefix="/internal/cleanup", tags=["internal"])


@router.post("/expired", response_model=CleanupResponse)
async def cleanup_expired_sessions(
    _cron_authorized: CronAuthorized,
    db: DbSession,
) -> CleanupResponse:
    deleted_sessions = await SessionCleanupService(db).delete_expired()
    return CleanupResponse(deleted_sessions=deleted_sessions)


@router.post("/wipe-all", response_model=CleanupResponse)
async def wipe_all_sessions(
    _cron_authorized: CronAuthorized,
    db: DbSession,
) -> CleanupResponse:
    deleted_sessions = await SessionCleanupService(db).delete_all()
    return CleanupResponse(deleted_sessions=deleted_sessions)
