import type { Icon } from "@phosphor-icons/react"
import {
  ArrowsDownUpIcon,
  GaugeIcon,
  PackageIcon,
  ShieldCheckeredIcon,
  TagSimpleIcon,
} from "@phosphor-icons/react"
import type { Permission } from "@/lib/estoca/rules"

export type NavItem = {
  href: string
  label: string
  icon: Icon
  requires?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/painel", label: "Painel", icon: GaugeIcon },
  { href: "/produtos", label: "Produtos", icon: PackageIcon },
  { href: "/categorias", label: "Categorias", icon: TagSimpleIcon },
  { href: "/movimentacoes", label: "Movimentações", icon: ArrowsDownUpIcon },
  { href: "/administracao", label: "Administração", icon: ShieldCheckeredIcon, requires: "administrar" },
]
