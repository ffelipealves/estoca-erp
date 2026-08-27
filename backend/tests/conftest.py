import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url


BACKEND_ROOT = Path(__file__).resolve().parents[1]
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://estoca:estoca@postgres:5432/estoca_test",
)

if make_url(TEST_DATABASE_URL).database != "estoca_test":
    raise RuntimeError("Tests must run against the estoca_test database")

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL


@pytest.fixture(scope="session", autouse=True)
def apply_migrations() -> Iterator[None]:
    alembic_config = Config(str(BACKEND_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    yield
