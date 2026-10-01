import type { StockBalancePoint } from "@/lib/api"
import type { Category, MovementType, Product } from "./types"
import { isLowStock, urgencyOf } from "./rules"

export function indexById<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]))
}

/** Money adds up in whole cents; reais only come back for display. */
function stockValueInCents(product: Product) {
  return Math.round(product.price * 100) * product.balance
}

export function getTotals({ products, categories }: { products: Product[]; categories: Category[] }) {
  let cents = 0
  let units = 0
  const used = new Set<string>()
  for (const p of products) {
    cents += stockValueInCents(p)
    units += p.balance
    used.add(p.categoryId)
  }
  return {
    value: cents / 100,
    units,
    activeCategories: categories.filter((c) => used.has(c.id)).length,
    totalCategories: categories.length,
    productCount: products.length,
  }
}

export function getLowStock(products: Product[]) {
  return products
    .filter(isLowStock)
    .map((p) => ({
      product: p,
      urgency: urgencyOf(p),
      ratio: p.lowStockLimit === 0 ? 0 : p.balance / p.lowStockLimit,
    }))
    .sort((a, b) => a.ratio - b.ratio || a.product.balance - b.product.balance)
}

export function getValueByCategory({ products, categories }: { products: Product[]; categories: Category[] }) {
  const rows = new Map<string, { category: Category; cents: number; units: number; count: number }>()
  for (const c of categories) rows.set(c.id, { category: c, cents: 0, units: 0, count: 0 })
  for (const p of products) {
    const row = rows.get(p.categoryId)
    if (!row) continue
    row.cents += stockValueInCents(p)
    row.units += p.balance
    row.count += 1
  }
  const list = [...rows.values()].sort((a, b) => b.cents - a.cents)
  const total = list.reduce((sum, r) => sum + r.cents, 0)
  return list.map(({ cents, ...r }) => ({ ...r, value: cents / 100, share: total === 0 ? 0 : cents / total }))
}

export type TimelineMovement = {
  id: string
  type: MovementType
  productId: string
  delta: number
  createdAt: string
}

export type TimelinePoint = {
  t: number
  units: number
  /** The movement behind this step; null for the opening point and for "now". */
  movement: TimelineMovement | null
  /** How many movements share this instant (the seed's opening stock is one). */
  count: number
}

/**
 * Total balance over time as a step series, from the API's running total.
 * Movements recorded at the same instant are one state of the stock, so they
 * collapse into a single step; the last step extends to "now".
 */
export function toTimeline(points: StockBalancePoint[], now: number): TimelinePoint[] {
  const out: TimelinePoint[] = []
  for (const point of points) {
    const t = new Date(point.at).getTime()
    const movement: TimelineMovement = {
      id: point.movement_id,
      type: point.type,
      productId: point.product_id,
      delta: point.delta,
      createdAt: point.at,
    }
    const last = out[out.length - 1]
    if (last && last.t === t) {
      last.units = point.total_quantity
      last.movement = null
      last.count += 1
    } else {
      out.push({ t, units: point.total_quantity, movement, count: 1 })
    }
  }
  const last = out[out.length - 1]
  if (last) out.push({ t: Math.max(now, last.t), units: last.units, movement: null, count: 0 })
  return out
}
