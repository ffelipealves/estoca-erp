from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.category import Category
from app.models.demo_user import DemoUser
from app.models.enums import UserRole
from app.models.product import Product
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository


DEMO_PASSWORD = "demo123"

CATEGORY_NAMES = (
    "Alimentos",
    "Eletrônicos",
    "Escritório",
    "Limpeza",
)

PRODUCT_SEEDS = (
    ("Alimentos", "Café 500g", "CF-001", "18.90", 5),
    ("Eletrônicos", "Monitor 24 polegadas", "MN-001", "899.90", 3),
    ("Eletrônicos", "Mouse sem fio", "MS-001", "89.90", 5),
    ("Eletrônicos", "Teclado mecânico", "TC-001", "249.90", 3),
    ("Escritório", "Caderno universitário", "CD-001", "24.90", 10),
    ("Escritório", "Caneta esferográfica", "CN-001", "3.50", 20),
    ("Escritório", "Papel A4", "PA-001", "32.90", 5),
    ("Limpeza", "Detergente neutro", "DT-001", "4.99", 10),
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

    async def seed_session(self, session_id: UUID) -> SeedResult:
        categories_created = 0
        products_created = 0
        users_created = 0

        category_count = await self.categories.count_by_session(session_id)
        product_count = await self.products.count_by_session(session_id)
        if category_count == 0 and product_count == 0:
            categories = await self._create_categories(session_id)
            products_created = await self._create_products(session_id, categories)
            categories_created = len(categories)

        if await self.users.count_by_session(session_id) == 0:
            users_created = await self._create_users(session_id)

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
    ) -> int:
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
            for category_name, name, sku, price, low_stock_threshold in PRODUCT_SEEDS
        ]
        await self.products.create_many(products)
        return len(products)

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
