import type { Metadata } from "next"
import { ProductList } from "@/components/products/ProductList"

export const metadata: Metadata = { title: "Produtos" }

// Provisório: a tela anterior ao redesign, até a etapa que a substitui.
export default function Page() {
  return <ProductList />
}
