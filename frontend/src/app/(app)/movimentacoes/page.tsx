import type { Metadata } from "next"
import { MovementList } from "@/components/movements/MovementList"

export const metadata: Metadata = { title: "Movimentações" }

// Provisório: a tela anterior ao redesign, até a etapa que a substitui.
export default function Page() {
  return <MovementList />
}
