from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SAEnum
from sqlalchemy import ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import StockMovementType

if TYPE_CHECKING:
    from app.models.demo_user import DemoUser
    from app.models.product import Product
    from app.models.session import Session


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index(
            "ix_stock_movements_session_product_created_at",
            "session_id",
            "product_id",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        index=True,
    )
    product_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE")
    )
    performed_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("demo_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    type: Mapped[StockMovementType] = mapped_column(
        SAEnum(
            StockMovementType,
            name="stock_movement_type",
            native_enum=True,
            validate_strings=True,
        )
    )
    quantity: Mapped[int] = mapped_column(Integer)
    resulting_quantity: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped[Session] = relationship(back_populates="stock_movements")
    product: Mapped[Product] = relationship(back_populates="stock_movements")
    performed_by_user: Mapped[DemoUser | None] = relationship(
        back_populates="stock_movements"
    )
