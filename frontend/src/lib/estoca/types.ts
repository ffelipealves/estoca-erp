export type Role = "admin" | "operador"

export type MovementType = "entrada" | "saida" | "ajuste"

export interface Category {
  id: string
  name: string
  /** Empty when the category has none. */
  description: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  sku: string
  categoryId: string
  /** For display and totals only; writes send the API's decimal string. */
  price: number
  balance: number
  lowStockLimit: number
  createdAt: string
}

export interface Movement {
  id: string
  productId: string
  type: MovementType
  /** Entrada/Saída: amount moved. Ajuste: the counted final balance. */
  quantity: number
  previousBalance: number
  resultingBalance: number
  note: string
  createdAt: string
}

export type ProductDraft = {
  name: string
  sku: string
  categoryId: string
  price: number
  lowStockLimit: number
  initialQuantity: number
}

export type CategoryDraft = {
  name: string
  description: string
}

export type MovementDraft = {
  productId: string
  type: MovementType
  quantity: number
  note: string
}
