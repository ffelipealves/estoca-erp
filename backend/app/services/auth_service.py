from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthenticationError
from app.core.security import create_access_token, verify_password
from app.models.demo_user import DemoUser
from app.repositories.demo_user_repository import DemoUserRepository

DUMMY_PASSWORD_HASH = "$2b$12$LkXSn5emUtUN.ADeoveXIOpfoqSla9eff2XkRLxayMZJIAvnDE61O"


@dataclass(frozen=True, slots=True)
class LoginResult:
    access_token: str
    user: DemoUser


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.users = DemoUserRepository(db)

    async def login(
        self,
        *,
        session_id: UUID,
        email: str,
        password: str,
    ) -> LoginResult:
        user = await self.users.get_by_email(session_id, email)

        if user is None:
            verify_password(password, DUMMY_PASSWORD_HASH)
            raise AuthenticationError("Email ou senha inválidos")

        if not verify_password(password, user.password_hash):
            raise AuthenticationError("Email ou senha inválidos")

        access_token = create_access_token(
            user_id=user.id,
            session_id=user.session_id,
            role=user.role,
        )
        return LoginResult(access_token=access_token, user=user)
