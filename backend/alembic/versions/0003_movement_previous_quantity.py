"""movement_previous_quantity

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-30 21:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "stock_movements",
        sa.Column("previous_quantity", sa.Integer(), nullable=True),
    )
    # Entrada e saída guardam o delta, então o saldo anterior sai exato da
    # própria linha. Ajuste guarda só o saldo final: aí o anterior é o saldo
    # resultante da linha anterior do mesmo produto (zero na primeira). A ordem
    # por `created_at` pode divergir da ordem real em escritas concorrentes no
    # mesmo produto — por isso o `LAG` fica restrito ao ajuste.
    op.execute(
        """
        UPDATE stock_movements AS movement
        SET previous_quantity = CASE movement.type
            WHEN 'entrada' THEN movement.resulting_quantity - movement.quantity
            WHEN 'saida' THEN movement.resulting_quantity + movement.quantity
            ELSE history.lagged_quantity
        END
        FROM (
            SELECT
                id,
                COALESCE(
                    LAG(resulting_quantity) OVER (
                        PARTITION BY product_id
                        ORDER BY created_at, id
                    ),
                    0
                ) AS lagged_quantity
            FROM stock_movements
        ) AS history
        WHERE movement.id = history.id
        """
    )
    op.alter_column("stock_movements", "previous_quantity", nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("stock_movements", "previous_quantity")
