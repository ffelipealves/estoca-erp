import type { Metadata } from "next"
import { Suspense } from "react"
import { ProdutosView } from "@/components/estoca/produtos/produtos-view"

export const metadata: Metadata = { title: "Produtos" }

export default function ProdutosPage() {
  // Filters and sorting live in the URL, read on the client.
  return (
    <Suspense>
      <ProdutosView />
    </Suspense>
  )
}
