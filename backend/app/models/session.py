from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.demo_user import DemoUser
    from app.models.product import Product
    from app.models.stock_movement import StockMovement


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    demo_users: Mapped[list[DemoUser]] = relationship(
        back_populates="session", passive_deletes=True
    )
    categories: Mapped[list[Category]] = relationship(
        back_populates="session", passive_deletes=True
    )
    products: Mapped[list[Product]] = relationship(
        back_populates="session", passive_deletes=True
    )
    stock_movements: Mapped[list[StockMovement]] = relationship(
        back_populates="session", passive_deletes=True
    )
