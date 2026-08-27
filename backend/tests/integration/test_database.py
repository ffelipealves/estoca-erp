from sqlalchemy import text

from app.core.database import async_session_factory


async def test_database_connection_uses_test_database() -> None:
    async with async_session_factory() as db:
        database_name = await db.scalar(text("SELECT current_database()"))

    assert database_name == "estoca_test"
