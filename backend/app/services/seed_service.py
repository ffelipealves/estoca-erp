from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.category import Category
from app.models.demo_user import DemoUser
from app.models.enums import StockMovementType, UserRole
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.repositories.category_repository import CategoryRepository
from app.repositories.demo_user_repository import DemoUserRepository
from app.repositories.product_repository import ProductRepository
from app.services.stock_movement_service import StockMovementService

DEMO_PASSWORD = "demo123"

# Horário de Brasília sem horário de verão desde 2019: o deslocamento é fixo, e
# o seed não depende de base de fusos no container.
SEED_TIMEZONE = timezone(timedelta(hours=-3), "BRT")

# O histórico fabricado começa à meia-noite de 14 dias atrás. A última movimentação
# cai na véspera, então nunca compete com as que o visitante registrar.
HISTORY_DAYS = 14

# O estoque inicial de cada produto entra no primeiro dia, um minuto após o outro,
# antes da primeira movimentação do dia a dia.
OPENING_STOCK_TIME = time(8, 0)

CATEGORY_NAMES = (
    "Ferramentas manuais",
    "Elétrica",
    "Hidráulica",
    "Fixação",
)

# Tabelas de dados: uma linha por registro lê melhor que a quebra do formatador.
# fmt: off
# (categoria, nome, SKU, preço, aviso de estoque baixo, estoque inicial)
PRODUCT_SEEDS = (
    ("Ferramentas manuais", "Martelo unha 27 mm, cabo de fibra", "FER-1027", "49.90", 6, 24),
    ("Ferramentas manuais", 'Chave de fenda 1/4" x 6"', "FER-1104", "18.50", 10, 40),
    ("Ferramentas manuais", 'Alicate universal 8"', "FER-1208", "42.90", 5, 12),
    ("Ferramentas manuais", "Trena emborrachada 5 m", "FER-1305", "27.40", 6, 10),
    ("Elétrica", "Cabo flexível 2,5 mm², rolo 100 m", "ELE-2025", "289.00", 3, 8),
    ("Elétrica", "Disjuntor bipolar 32 A", "ELE-2132", "64.90", 8, 14),
    ("Elétrica", "Tomada 2P+T 10 A branca", "ELE-2210", "12.80", 30, 120),
    ("Elétrica", "Fita isolante 19 mm x 20 m", "ELE-2319", "8.90", 20, 60),
    ("Hidráulica", "Tubo PVC soldável 25 mm, barra 6 m", "HID-3025", "32.70", 10, 30),
    ("Hidráulica", 'Registro de gaveta 3/4"', "HID-3134", "58.40", 5, 9),
    ("Hidráulica", "Joelho PVC 90° 25 mm", "HID-3290", "1.95", 50, 200),
    ("Hidráulica", "Fita veda rosca 18 mm x 25 m", "HID-3318", "6.60", 12, 48),
    ("Fixação", "Parafuso Phillips 4,2 x 32 mm, cx 100", "FIX-4032", "23.90", 10, 25),
    ("Fixação", "Bucha de nylon 8 mm, cx 100", "FIX-4108", "14.30", 10, 30),
    ("Fixação", "Prego 17 x 27 com cabeça, kg", "FIX-4217", "21.80", 6, 18),
    ("Fixação", 'Arruela lisa 1/4", cx 50', "FIX-4314", "9.70", 10, 40),
)

# (dia a partir do início do histórico, hora, minuto, SKU, tipo, quantidade, nota)
MOVEMENT_SEEDS = (
    (0, 9, 10, "ELE-2210", StockMovementType.entrada, 60, "NF 18.204, Eletro Sul Distribuidora"),
    (0, 14, 32, "HID-3290", StockMovementType.saida, 40, "Obra Rua dos Tupis, 118"),
    (1, 10, 5, "ELE-2132", StockMovementType.saida, 6, "Pedido 5531"),
    (1, 16, 20, "FIX-4032", StockMovementType.saida, 12, None),
    (2, 8, 45, "ELE-2025", StockMovementType.entrada, 4, "NF 18.377"),
    (2, 11, 30, "HID-3134", StockMovementType.saida, 5, "Pedido 5540"),
    (3, 9, 0, "FER-1305", StockMovementType.ajuste, 7, "Contagem mensal: 3 unidades avariadas"),
    (3, 15, 40, "FER-1027", StockMovementType.saida, 8, "Pedido 5547"),
    (4, 10, 15, "HID-3025", StockMovementType.saida, 12, "Obra Jardim Europa"),
    (4, 17, 5, "ELE-2319", StockMovementType.saida, 18, None),
    (5, 9, 20, "FIX-4032", StockMovementType.entrada, 10, "NF 3.112"),
    (5, 13, 50, "FER-1104", StockMovementType.saida, 14, "Pedido 5561"),
    (6, 8, 30, "HID-3290", StockMovementType.entrada, 150, "NF 18.512"),
    (6, 16, 10, "ELE-2132", StockMovementType.saida, 5, "Pedido 5570"),
    (7, 10, 40, "FER-1208", StockMovementType.saida, 7, "Pedido 5574"),
    (8, 9, 5, "HID-3318", StockMovementType.ajuste, 44, "Inventário cíclico"),
    (8, 14, 25, "HID-3134", StockMovementType.saida, 4, "Pedido 5582"),
    (9, 11, 0, "FIX-4217", StockMovementType.saida, 6, None),
    (10, 9, 45, "FIX-4032", StockMovementType.saida, 17, "Obra Rua dos Tupis, 118"),
    (11, 10, 30, "ELE-2210", StockMovementType.saida, 45, "Pedido 5601"),
    (12, 15, 15, "FIX-4108", StockMovementType.ajuste, 26, "Contagem: caixa aberta no depósito"),
    (13, 9, 10, "FER-1305", StockMovementType.saida, 3, "Pedido 5613"),
    (13, 16, 45, "FIX-4314", StockMovementType.entrada, 20, "NF 3.140"),
)
# fmt: on


def history_start(now: datetime) -> datetime:
    """Meia-noite, no horário de Brasília, de `HISTORY_DAYS` dias atrás."""
    local_day = (now.astimezone(SEED_TIMEZONE) - timedelta(days=HISTORY_DAYS)).date()
    return datetime.combine(local_day, time(0, 0), tzinfo=SEED_TIMEZONE)


@dataclass(frozen=True, slots=True)
class SeedResult:
    categories_created: int
    products_created: int
    users_created: int


class SeedService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
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
        start = history_start(datetime.now(UTC))
        opening_at = datetime.combine(
            start.date(), OPENING_STOCK_TIME, tzinfo=start.tzinfo
        )
        # Cada movimentação fabricada e o carimbo que ela recebe: primeiro o estoque
        # inicial de cada produto, depois as movimentações do dia a dia.
        history: list[tuple[StockMovement, datetime]] = []

        for index, (
            _category_name,
            _name,
            sku,
            _price,
            _threshold,
            initial_quantity,
        ) in enumerate(PRODUCT_SEEDS):
            movement = await self.stock_movements.record_initial_stock(
                session_id=session_id,
                product=products_by_sku[sku],
                performed_by_user_id=admin.id,
                quantity=initial_quantity,
            )
            history.append((movement, opening_at + timedelta(minutes=index)))

        for day, hour, minute, sku, movement_type, quantity, note in MOVEMENT_SEEDS:
            # Ajuste é contagem física, feita pelo admin; o operador movimenta.
            author = admin if movement_type == StockMovementType.ajuste else operator
            movement = await self.stock_movements.create(
                session_id=session_id,
                product_id=products_by_sku[sku].id,
                performed_by_user_id=author.id,
                movement_type=movement_type,
                quantity=quantity,
                note=note,
            )
            history.append(
                (movement, start + timedelta(days=day, hours=hour, minutes=minute))
            )

        await self._stamp_history(history)

    async def _stamp_history(
        self,
        history: list[tuple[StockMovement, datetime]],
    ) -> None:
        """Dá a cada movimentação fabricada o seu carimbo no passado.

        O seed roda inteiro em uma transação e `created_at` usa
        `server_default=func.now()` — que no Postgres é o horário da *transação*.
        Sem esta passada, as movimentações nasceriam todas com o mesmo carimbo:
        a linha do tempo desaparece e o filtro por período não tem o que filtrar.

        Isto não afrouxa o invariante de que `created_at` é gerado no servidor:
        quem fabrica a data aqui é o próprio servidor montando a sandbox, e
        `POST /stock-movements` continua recusando o campo vindo do cliente.
        A expiração de sessão não é afetada — ela olha `sessions`, não estas
        linhas.
        """
        for movement, stamp in history:
            movement.created_at = stamp

        await self.db.flush()

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
