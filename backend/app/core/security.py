from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings
from app.core.errors import AuthenticationError
from app.models.enums import UserRole

password_hash = PasswordHash((BcryptHasher(),))


@dataclass(frozen=True, slots=True)
class AccessTokenPayload:
    user_id: UUID
    session_id: UUID
    role: UserRole
    expires_at: datetime


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, password_hash_value: str) -> bool:
    try:
        return password_hash.verify(password, password_hash_value)
    except (UnknownHashError, ValueError):
        return False


def create_access_token(
    *,
    user_id: UUID,
    session_id: UUID,
    role: UserRole,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(UTC)
    expires_at = now + (
        expires_delta or timedelta(minutes=settings.jwt_expiration_minutes)
    )
    payload = {
        "sub": str(user_id),
        "session_id": str(session_id),
        "role": role.value,
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> AccessTokenPayload:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "session_id", "role", "exp"]},
        )
        return AccessTokenPayload(
            user_id=UUID(payload["sub"]),
            session_id=UUID(payload["session_id"]),
            role=UserRole(payload["role"]),
            expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
        )
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise AuthenticationError("Token inválido ou expirado") from exc
