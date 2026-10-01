import type { Metadata } from "next"
import { Suspense } from "react"
import { MovimentacoesView } from "@/components/estoca/movimentacoes/movimentacoes-view"

export const metadata: Metadata = { title: "Movimentações" }

export default function MovimentacoesPage() {
  // Filters and the page live in the URL, read on the client.
  return (
    <Suspense>
      <MovimentacoesView />
    </Suspense>
  )
}
