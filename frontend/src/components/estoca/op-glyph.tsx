import { cn } from "@/lib/utils"
import { MOVEMENT_META } from "@/lib/estoca/rules"
import type { MovementType } from "@/lib/estoca/types"

const TONE: Record<MovementType, string> = {
  entrada: "bg-entrada text-white border-[#216a49]",
  saida: "bg-saida text-white border-[#712c23]",
  ajuste: "bg-ajuste text-white border-[#2c4188]",
}

/**
 * The operation sign as a small key: + entrada, − saída, = ajuste.
 * Color is never the only carrier: the glyph and the label ride along.
 */
export function OpGlyph({
  type,
  size = "md",
  className,
}: {
  type: MovementType
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm border-b-2 leading-none font-bold",
        size === "sm" && "size-5 text-[13px]",
        size === "md" && "size-6 text-[15px]",
        size === "lg" && "size-9 text-xl",
        TONE[type],
        className,
      )}
    >
      {MOVEMENT_META[type].glyph}
    </span>
  )
}

export function OpLabel({ type, className }: { type: MovementType; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <OpGlyph type={type} size="sm" />
      {MOVEMENT_META[type].label}
    </span>
  )
}

/** Signed quantity as the history shows it. Ajuste shows the absolute target. */
export function signedQuantity(type: MovementType, quantity: number, previous: number) {
  if (type === "entrada") return `+${quantity}`
  if (type === "saida") return `−${quantity}`
  const diff = quantity - previous
  return `=${quantity}` + (diff === 0 ? "" : ` (${diff > 0 ? "+" : "−"}${Math.abs(diff)})`)
}
