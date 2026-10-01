"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Logo } from "@/components/estoca/logo"
import { Button } from "@/components/ui/button"
import { ROLE_LABEL } from "@/lib/estoca/rules"
import { useActions, useRole } from "@/lib/estoca/store"
import { cn } from "@/lib/utils"

const AREAS = [
  { href: "/painel", label: "Painel" },
  { href: "/produtos", label: "Produtos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/movimentacoes", label: "Movimentações" },
  { href: "/administracao", label: "Administração" },
]

/** Provisório: navegação mínima até o shell do redesign (etapa F3). */
export function InterimShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const role = useRole()
  const { logout } = useActions()

  return (
    <>
      <header className="on-rail flex flex-wrap items-center gap-x-6 gap-y-2 bg-rail px-4 py-3 text-rail-foreground">
        <Logo />
        <nav aria-label="Navegação principal" className="flex flex-wrap gap-1">
          {AREAS.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              aria-current={pathname === area.href ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-[#cfd5d3] hover:bg-white/5",
                pathname === area.href && "bg-rail-raised font-semibold text-rail-foreground",
              )}
            >
              {area.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-rail-muted">
          {ROLE_LABEL[role]}
          <Button
            size="sm"
            onClick={() => {
              logout()
              router.replace("/entrar")
            }}
          >
            Sair
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </>
  )
}
