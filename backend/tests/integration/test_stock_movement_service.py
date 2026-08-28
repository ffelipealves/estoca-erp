import pytest

from app.core.database import async_session_factory
from app.core.errors import BusinessRuleError, LimitExceededError
from app.models.enums import StockMovementType
from app.models.stock_movement import StockMovement
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.stock_movement_repository import StockMovementRepository
from app.services.seed_service import SeedService
from app.services.session_service import SessionService
from app.services.stock_movement_service import StockMovementService


async def test_stock_movement_rules_keep_balance_and_history_consistent() -> None:
    async with async_session_factory() as db:
        session = (await SessionService(db).resolve_or_create(None)).session
        await SeedService(db).seed_session(session.id)
        product = (await ProductRepository(db).list_by_session(session.id))[0]
        user = (await DemoUserRepository(db).list_by_session(session.id))[0]
        service = StockMovementService(db)

        entrance = await service.create(
            session_id=session.id,
            product_id=product.id,
            performed_by_user_id=user.id,
            movement_type=StockMovementType.entrada,
            quantity=10,
            note=" Reposição ",
        )
        assert entrance.resulting_quantity == 10
        assert entrance.note == "Reposição"

        output = await service.create(
            session_id=session.id,
            product_id=product.id,
            performed_by_user_id=user.id,
            movement_type=StockMovementType.saida,
            quantity=4,
        )
        assert output.resulting_quantity == 6

        with pytest.raises(
            BusinessRuleError,
            match="Saldo insuficiente para esta saída",
        ):
            await service.create(
                session_id=session.id,
                product_id=product.id,
                performed_by_user_id=user.id,
                movement_type=StockMovementType.saida,
                quantity=7,
            )

        adjustment = await service.create(
            session_id=session.id,
            product_id=product.id,
            performed_by_user_id=user.id,
            movement_type=StockMovementType.ajuste,
            quantity=2,
        )
        assert adjustment.quantity == 2
        assert adjustment.resulting_quantity == 2

        refreshed_product = await ProductRepository(db).get_by_id(
            session.id,
            product.id,
        )
        assert refreshed_product is not None
        assert refreshed_product.quantity == 2

        movements = await StockMovementRepository(db).list_by_product(
            session.id,
            product.id,
        )
        resulting_quantities = {
            movement.type: movement.resulting_quantity for movement in movements
        }
        assert resulting_quantities == {
            StockMovementType.entrada: 10,
            StockMovementType.saida: 6,
            StockMovementType.ajuste: 2,
        }

        await db.rollback()


async def test_stock_movement_limit_blocks_balance_change() -> None:
    async with async_session_factory() as db:
        session = (await SessionService(db).resolve_or_create(None)).session
        await SeedService(db).seed_session(session.id)
        product = (await ProductRepository(db).list_by_session(session.id))[0]
        user = (await DemoUserRepository(db).list_by_session(session.id))[0]
        movements = [
            StockMovement(
                session_id=session.id,
                product_id=product.id,
                performed_by_user_id=user.id,
                type=StockMovementType.ajuste,
                quantity=0,
                resulting_quantity=0,
                note="Preenchimento do limite",
            )
            for _ in range(500)
        ]
        await StockMovementRepository(db).create_many(movements)

        with pytest.raises(
            LimitExceededError,
            match="Limite de 500 movimentações por sessão atingido",
        ):
            await StockMovementService(db).create(
                session_id=session.id,
                product_id=product.id,
                performed_by_user_id=user.id,
                movement_type=StockMovementType.entrada,
                quantity=1,
            )

        refreshed_product = await ProductRepository(db).get_by_id(
            session.id,
            product.id,
        )
        assert refreshed_product is not None
        assert refreshed_product.quantity == 0
        assert await StockMovementRepository(db).count_by_session(session.id) == 500

        await db.rollback()
