import type {
  Category as ApiCategory,
  Product as ApiProduct,
  StockMovement as ApiMovement,
} from "@/lib/api"
import type { Category, Movement, Product } from "./types"

/** The API speaks snake_case and decimal strings; the screens use these shapes. */
export function toCategory(category: ApiCategory): Category {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? "",
    createdAt: category.created_at,
  }
}

export function toProduct(product: ApiProduct): Product {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    categoryId: product.category_id,
    price: Number(product.price),
    balance: product.quantity,
    lowStockLimit: product.low_stock_threshold,
    createdAt: product.created_at,
  }
}

export function toMovement(movement: ApiMovement): Movement {
  return {
    id: movement.id,
    productId: movement.product_id,
    type: movement.type,
    quantity: movement.quantity,
    previousBalance: movement.previous_quantity,
    resultingBalance: movement.resulting_quantity,
    note: movement.note ?? "",
    createdAt: movement.created_at,
  }
}

/** Prices go back to the API as the decimal string it stores: 49.9 -> "49.90". */
export function toPriceString(price: number) {
  return price.toFixed(2)
}
