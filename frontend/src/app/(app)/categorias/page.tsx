import type { Metadata } from "next"
import { CategoryPanel } from "@/components/categories/CategoryPanel"

export const metadata: Metadata = { title: "Categorias" }

// Provisório: a tela anterior ao redesign, até a etapa que a substitui.
export default function Page() {
  return <CategoryPanel />
}
