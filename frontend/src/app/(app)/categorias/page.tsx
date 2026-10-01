import type { Metadata } from "next"
import { CategoriasView } from "@/components/estoca/categorias/categorias-view"

export const metadata: Metadata = { title: "Categorias" }

export default function CategoriasPage() {
  return <CategoriasView />
}
