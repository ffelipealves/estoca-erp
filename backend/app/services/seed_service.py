from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.category import Category
from app.models.demo_user import DemoUser
from app.models.enums import StockMovementType, UserRole
from app.models.product import Product
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.services.stock_movement_service import StockMovementService

DEMO_PASSWORD = "demo123"

CATEGORY_NAMES = (
    "Alimentos",
    "Eletrônicos",
    "Escritório",
    "Limpeza",
)

PRODUCT_SEEDS = (
    ("Alimentos", "Café 500g", "CF-001", "18.90", 8, 18),
    ("Alimentos", "Arroz 5kg", "AR-001", "31.90", 6, 14),
    ("Alimentos", "Açúcar 1kg", "AC-001", "5.49", 6, 4),
    ("Alimentos", "Biscoito integral", "BI-001", "7.90", 8, 21),
    ("Eletrônicos", "Monitor 24 polegadas", "MN-001", "899.90", 2, 8),
    ("Eletrônicos", "Mouse sem fio", "MS-001", "89.90", 5, 24),
    ("Eletrônicos", "Teclado mecânico", "TC-001", "249.90", 3, 11),
    ("Eletrônicos", "Fone Bluetooth", "FN-001", "159.90", 4, 3),
    ("Escritório", "Caderno universitário", "CD-001", "24.90", 10, 32),
    ("Escritório", "Caneta esferográfica", "CN-001", "3.50", 20, 60),
    ("Escritório", "Papel A4", "PA-001", "32.90", 5, 16),
    ("Escritório", "Grampeador de mesa", "GR-001", "28.50", 4, 9),
    ("Limpeza", "Detergente neutro", "DT-001", "4.99", 10, 28),
    ("Limpeza", "Desinfetante 2L", "DS-001", "12.90", 8, 19),
    ("Limpeza", "Esponja multiuso", "EP-001", "3.99", 12, 36),
    ("Limpeza", "Álcool 70% 1L", "AL-001", "11.50", 8, 13),
)

MOVEMENT_SEEDS = (
    ("CF-001", StockMovementType.entrada, 12, "Reposição do fornecedor"),
    ("CF-001", StockMovementType.saida, 7, "Saída para o salão"),
    ("MN-001", StockMovementType.saida, 2, "Equipamentos para novas estações"),
    ("MS-001", StockMovementType.saida, 5, "Distribuição para a equipe"),
    ("CN-001", StockMovementType.entrada, 40, "Compra mensal de suprimentos"),
    ("CN-001", StockMovementType.saida, 18, "Retirada pelo administrativo"),
    ("PA-001", StockMovementType.ajuste, 14, "Conferência de inventário"),
)


@dataclass(frozen=True, slots=True)
class SeedResult:
    categories_created: int
    products_created: int
    users_created: int


class SeedService:
    def __init__(self, db: AsyncSession) -> None:
        self.categories = CategoryRepository(db)
        self.products = ProductRepository(db)
        self.users = DemoUserRepository(db)
        self.stock_movements = StockMovementService(db)

    async def seed_session(self, session_id: UUID) -> SeedResult:
        categories_created = 0
        products_created = 0
        users_created = 0

        if await self.users.count_by_session(session_id) == 0:
            users_created = await self._create_users(session_id)

        category_count = await self.categories.count_by_session(session_id)
        product_count = await self.products.count_by_session(session_id)
        if category_count == 0 and product_count == 0:
            categories = await self._create_categories(session_id)
            products = await self._create_products(session_id, categories)
            await self._create_stock_history(session_id, products)
            categories_created = len(categories)
            products_created = len(products)

        return SeedResult(
            categories_created=categories_created,
            products_created=products_created,
            users_created=users_created,
        )

    async def _create_categories(self, session_id: UUID) -> list[Category]:
        categories = [
            Category(session_id=session_id, name=name) for name in CATEGORY_NAMES
        ]
        return await self.categories.create_many(categories)

    async def _create_products(
        self,
        session_id: UUID,
        categories: list[Category],
    ) -> list[Product]:
        category_ids = {category.name: category.id for category in categories}
        products = [
            Product(
                session_id=session_id,
                category_id=category_ids[category_name],
                name=name,
                sku=sku,
                price=Decimal(price),
                low_stock_threshold=low_stock_threshold,
            )
            for (
                category_name,
                name,
                sku,
                price,
                low_stock_threshold,
                _,
            ) in PRODUCT_SEEDS
        ]
        return await self.products.create_many(products)

    async def _create_stock_history(
        self,
        session_id: UUID,
        products: list[Product],
    ) -> None:
        admin = await self.users.get_by_email(session_id, "admin@estoca.demo")
        operator = await self.users.get_by_email(session_id, "operador@estoca.demo")
        if admin is None or operator is None:
            raise RuntimeError("Usuários demo ausentes durante a criação do seed")

        products_by_sku = {product.sku: product for product in products}
        for (
            _category_name,
            _name,
            sku,
            _price,
            _threshold,
            initial_quantity,
        ) in PRODUCT_SEEDS:
            await self.stock_movements.record_initial_stock(
                session_id=session_id,
                product=products_by_sku[sku],
                performed_by_user_id=admin.id,
                quantity=initial_quantity,
            )

        for sku, movement_type, quantity, note in MOVEMENT_SEEDS:
            await self.stock_movements.create(
                session_id=session_id,
                product_id=products_by_sku[sku].id,
                performed_by_user_id=operator.id,
                movement_type=movement_type,
                quantity=quantity,
                note=note,
            )

    async def _create_users(self, session_id: UUID) -> int:
        users = [
            DemoUser(
                session_id=session_id,
                email="admin@estoca.demo",
                password_hash=hash_password(DEMO_PASSWORD),
                role=UserRole.admin,
                full_name="Administrador Demo",
            ),
            DemoUser(
                session_id=session_id,
                email="operador@estoca.demo",
                password_hash=hash_password(DEMO_PASSWORD),
                role=UserRole.operador,
                full_name="Operador Demo",
            ),
        ]
        await self.users.create_many(users)
        return len(users)
