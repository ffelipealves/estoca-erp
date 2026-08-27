from datetime import UTC, datetime, timedelta
from unittest.mock import Mock

from app.models.session import Session
from app.services.session_service import SessionService


def test_session_expires_at_inactivity_limit() -> None:
    service = SessionService(Mock())
    started_at = datetime(2026, 8, 27, 12, tzinfo=UTC)
    session = Session(
        created_at=started_at,
        last_activity_at=started_at,
    )

    assert not service.is_expired(
        session,
        started_at + service.inactivity_limit - timedelta(seconds=1),
    )
    assert service.is_expired(
        session,
        started_at + service.inactivity_limit,
    )


def test_session_expires_at_maximum_age_even_if_recently_active() -> None:
    service = SessionService(Mock())
    started_at = datetime(2026, 8, 27, 12, tzinfo=UTC)
    session = Session(
        created_at=started_at,
        last_activity_at=started_at + timedelta(hours=23),
    )

    assert service.is_expired(session, started_at + service.max_age)
