from fastapi import APIRouter

from app.core.deps import CurrentSession, DbSession
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    credentials: LoginRequest,
    current_session: CurrentSession,
    db: DbSession,
) -> LoginResponse:
    result = await AuthService(db).login(
        session_id=current_session.id,
        email=credentials.email,
        password=credentials.password,
    )
    return LoginResponse(
        access_token=result.access_token,
        user=UserResponse.model_validate(result.user),
    )
