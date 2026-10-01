import type { MovementType, Product, Role } from "./types"

/** The one place stock semantics live. */
export function applyMovement(balance: number, type: MovementType, quantity: number) {
  switch (type) {
    case "entrada":
      return balance + quantity
    case "saida":
      return balance - quantity
    case "ajuste":
      return quantity
  }
}

export type MovementCheck =
  | { ok: true; resultingBalance: number; delta: number; fallsBelowLimit: boolean }
  | { ok: false; reason: "sem-produto" | "quantidade" | "saldo-insuficiente" | "ajuste-igual"; message: string }

export function checkMovement(
  product: Product | undefined,
  type: MovementType,
  quantity: number | null,
): MovementCheck {
  if (!product) {
    return { ok: false, reason: "sem-produto", message: "Escolha o produto." }
  }
  if (quantity === null || Number.isNaN(quantity)) {
    return {
      ok: false,
      reason: "quantidade",
      message: type === "ajuste" ? "Informe o saldo contado." : "Informe a quantidade.",
    }
  }
  if (!Number.isInteger(quantity)) {
    return { ok: false, reason: "quantidade", message: "Use apenas unidades inteiras." }
  }
  if (type === "ajuste") {
    if (quantity < 0) {
      return { ok: false, reason: "quantidade", message: "O saldo contado não pode ser negativo." }
    }
    if (quantity === product.balance) {
      return {
        ok: false,
        reason: "ajuste-igual",
        message: `O saldo já é ${product.balance}. Um ajuste só faz sentido se a contagem for diferente.`,
      }
    }
  } else if (quantity <= 0) {
    return { ok: false, reason: "quantidade", message: "A quantidade precisa ser maior que zero." }
  }
  if (type === "saida" && quantity > product.balance) {
    return {
      ok: false,
      reason: "saldo-insuficiente",
      message:
        product.balance === 0
          ? "Não há saldo disponível para retirar."
          : `Saldo insuficiente: há ${product.balance} disponíveis, você pediu ${quantity}.`,
    }
  }
  const resultingBalance = applyMovement(product.balance, type, quantity)
  return {
    ok: true,
    resultingBalance,
    delta: resultingBalance - product.balance,
    fallsBelowLimit: resultingBalance <= product.lowStockLimit,
  }
}

export function isLowStock(product: Pick<Product, "balance" | "lowStockLimit">) {
  return product.balance <= product.lowStockLimit
}

export type Urgency = "zerado" | "critico" | "baixo"

export function urgencyOf(product: Pick<Product, "balance" | "lowStockLimit">): Urgency {
  if (product.balance === 0) return "zerado"
  if (product.balance <= product.lowStockLimit / 2) return "critico"
  return "baixo"
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  zerado: "Zerado",
  critico: "Crítico",
  baixo: "Baixo",
}

export type Permission =
  | "consultar"
  | "movimentar"
  | "gerir-produtos"
  | "gerir-categorias"
  | "administrar"

export const PERMISSIONS: Record<Role, Record<Permission, boolean>> = {
  admin: {
    consultar: true,
    movimentar: true,
    "gerir-produtos": true,
    "gerir-categorias": true,
    administrar: true,
  },
  operador: {
    consultar: true,
    movimentar: true,
    "gerir-produtos": false,
    "gerir-categorias": false,
    administrar: false,
  },
}

export const PERMISSION_ROWS: { key: Permission; label: string }[] = [
  { key: "consultar", label: "Consultar painel, produtos, categorias e histórico" },
  { key: "movimentar", label: "Registrar entradas, saídas e ajustes" },
  { key: "gerir-produtos", label: "Criar, editar e excluir produtos" },
  { key: "gerir-categorias", label: "Criar, editar e excluir categorias" },
  { key: "administrar", label: "Ver administração e resetar a sandbox" },
]

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  operador: "Operador",
}

/** What a fresh sandbox starts with. Mirrors `backend/app/services/seed_service.py`. */
export const SEED_COUNTS = {
  categories: 4,
  products: 16,
  /** One opening entry per product plus 23 day-to-day movements. */
  movements: 39,
}

export const MOVEMENT_META: Record<
  MovementType,
  { label: string; verb: string; done: string; glyph: string; explain: string; quantityLabel: string }
> = {
  entrada: {
    label: "Entrada",
    verb: "Confirmar entrada",
    done: "Entrada registrada",
    glyph: "+",
    explain: "Soma a quantidade ao saldo atual. Use ao receber mercadoria.",
    quantityLabel: "Quantidade recebida",
  },
  saida: {
    label: "Saída",
    verb: "Confirmar saída",
    done: "Saída registrada",
    glyph: "−",
    explain: "Retira a quantidade do saldo atual. Não pode passar do disponível.",
    quantityLabel: "Quantidade retirada",
  },
  ajuste: {
    label: "Ajuste",
    verb: "Confirmar ajuste",
    done: "Ajuste registrado",
    glyph: "=",
    explain:
      "Define o saldo final depois de uma contagem física. Não soma nem subtrai: o número informado passa a ser o saldo.",
    quantityLabel: "Saldo contado",
  },
}
