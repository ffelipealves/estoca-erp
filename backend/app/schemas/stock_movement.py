from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import StockMovementType


class StockMovementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    type: StockMovementType
    quantity: int = Field(ge=0)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    performed_by_user_id: UUID | None
    type: StockMovementType
    quantity: int
    resulting_quantity: int
    note: str | None
    created_at: datetime


class StockMovementPage(BaseModel):
    items: list[StockMovementResponse]
    page: int
    page_size: int
    total: int
    pages: int
