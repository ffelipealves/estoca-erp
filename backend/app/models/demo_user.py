from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.stock_movement import StockMovement


class DemoUser(Base):
    __tablename__ = "demo_users"
    __table_args__ = (
        UniqueConstraint("session_id", "email", name="uq_demo_users_session_email"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", native_enum=True, validate_strings=True)
    )
    full_name: Mapped[str] = mapped_column(String(120))

    session: Mapped[Session] = relationship(back_populates="demo_users")
    stock_movements: Mapped[list[StockMovement]] = relationship(
        back_populates="performed_by_user", passive_deletes=True
    )
