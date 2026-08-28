from app.core.config import Settings


def test_normalizes_neon_connection_string_for_asyncpg():
    settings = Settings(
        database_url=(
            "postgresql://user:password@ep-example-pooler.us-east-2.aws.neon.tech/"
            "neondb?sslmode=require&channel_binding=require"
        )
    )

    assert settings.database_url == (
        "postgresql+asyncpg://user:password@"
        "ep-example-pooler.us-east-2.aws.neon.tech/neondb?ssl=require"
    )


def test_preserves_asyncpg_connection_options():
    settings = Settings(
        database_url="postgresql+asyncpg://user:password@postgres:5432/estoca"
    )

    assert settings.database_url == (
        "postgresql+asyncpg://user:password@postgres:5432/estoca"
    )
