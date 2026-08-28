from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


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
