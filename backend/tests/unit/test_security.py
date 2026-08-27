from datetime import timedelta
from uuid import uuid4

import pytest

from app.core.errors import AuthenticationError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.enums import UserRole


def test_hash_and_verify_password() -> None:
    password = "senha-demo-segura"
    hashed_password = hash_password(password)

    assert hashed_password.startswith("$2")
    assert verify_password(password, hashed_password)
    assert not verify_password("senha-incorreta", hashed_password)
    assert not verify_password(password, "hash-invalido")


def test_access_token_round_trip() -> None:
    user_id = uuid4()
    session_id = uuid4()

    token = create_access_token(
        user_id=user_id,
        session_id=session_id,
        role=UserRole.admin,
    )
    payload = decode_access_token(token)

    assert payload.user_id == user_id
    assert payload.session_id == session_id
    assert payload.role is UserRole.admin


def test_expired_access_token_is_rejected() -> None:
    token = create_access_token(
        user_id=uuid4(),
        session_id=uuid4(),
        role=UserRole.operador,
        expires_delta=timedelta(seconds=-1),
    )

    with pytest.raises(AuthenticationError, match="Token inválido ou expirado"):
        decode_access_token(token)
