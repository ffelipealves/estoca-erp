import type { Metadata } from "next"
import { DashboardPanel } from "@/components/dashboard/DashboardPanel"

export const metadata: Metadata = { title: "Painel" }

// Provisório: a tela anterior ao redesign, até a etapa que a substitui.
export default function Page() {
  return <DashboardPanel />
}
