import type { MovementType } from "@/lib/estoca/types"

export const OP_COLOR: Record<MovementType, string> = {
  entrada: "#368d64",
  saida: "#973c30",
  ajuste: "#3c58b4",
}
const SURFACE = "#fbfcfb"

/** Shape is the second channel: ▲ entrada, ▼ saída, ◆ ajuste. */
export function OpShape({ type, cx, cy, r = 5 }: { type: MovementType; cx: number; cy: number; r?: number }) {
  const fill = OP_COLOR[type]
  const common = { fill, stroke: SURFACE, strokeWidth: 2, strokeLinejoin: "round" as const }
  if (type === "entrada") {
    return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`} {...common} />
  }
  if (type === "saida") {
    return <polygon points={`${cx - r - 1},${cy - r} ${cx + r + 1},${cy - r} ${cx},${cy + r + 1}`} {...common} />
  }
  return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`} {...common} />
}

