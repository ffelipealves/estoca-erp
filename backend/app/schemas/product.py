from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: UUID
    name: str = Field(min_length=1, max_length=150)
    sku: str = Field(min_length=1, max_length=50)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    low_stock_threshold: int = Field(default=5, ge=0)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("sku", mode="before")
    @classmethod
    def normalize_sku(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class ProductCreate(ProductWrite):
    initial_quantity: int = Field(default=0, ge=0)


class ProductUpdate(ProductWrite):
    pass


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    name: str
    sku: str
    price: Decimal
    quantity: int
    low_stock_threshold: int
    created_at: datetime
    updated_at: datetime
