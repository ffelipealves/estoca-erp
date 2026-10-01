import type { Metadata } from "next"
import { AdminPanel } from "@/components/admin/AdminPanel"

export const metadata: Metadata = { title: "Administração" }

// Provisório: a tela anterior ao redesign, até a etapa que a substitui.
export default function Page() {
  return <AdminPanel />
}
