import type { Metadata } from "next"
import { AdministracaoView } from "@/components/estoca/administracao/administracao-view"

export const metadata: Metadata = { title: "Administração" }

export default function AdministracaoPage() {
  return <AdministracaoView />
}
