"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import {
  CaretDownIcon,
  CopyIcon,
  HourglassMediumIcon,
  ListIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
  SignOutIcon,
  UserSwitchIcon,
} from "@phosphor-icons/react"
import { useActions, useEstoca } from "@/lib/estoca/store"
import { PERMISSIONS, ROLE_LABEL } from "@/lib/estoca/rules"
import { formatSandboxId } from "@/lib/estoca/format"
import type { Role } from "@/lib/estoca/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { OverlaysProvider, useOverlays } from "../overlays"
import { Countdown } from "../countdown"
import { Kbd } from "../kbd"
import { Logo } from "../logo"
import { ReadField } from "./read-field"
import { NAV_ITEMS } from "./nav-items"
import { cn } from "@/lib/utils"

/** Render only with a logged-in role: the `(app)` layout guards the way in. */
export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <OverlaysProvider>
      <Shortcuts />
      <div className="flex min-h-[100dvh] flex-col">
        <StatusBar role={role} />
        <div className="flex flex-1">
          <div className="hidden w-60 shrink-0 bg-rail lg:block">
            <aside className="on-rail sticky top-10 flex h-[calc(100dvh-2.5rem)] flex-col text-rail-foreground">
              <RailContent role={role} />
            </aside>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <Toolbar role={role} />
            <main id="conteudo" className="flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
              <div className="mx-auto w-full max-w-[1320px]">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </OverlaysProvider>
  )
}

function StatusBar({ role }: { role: Role }) {
  const { sandbox } = useEstoca()
  const { login, logout } = useActions()
  const other: Role = role === "admin" ? "operador" : "admin"

  return (
    <div className="on-rail sticky top-0 z-40 flex h-10 items-center gap-3 border-b border-white/10 bg-rail px-3 text-[13px] text-rail-muted sm:px-4">
      <MobileNav role={role} />
      <span className="flex items-center gap-1.5 font-semibold text-rail-foreground">
        <ShieldCheckIcon className="size-4" weight="bold" />
        <span className="sm:hidden">Isolada</span>
        <span className="hidden sm:inline">Sandbox isolada</span>
      </span>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(sandbox.id)
            toast.success("ID da sandbox copiado")
          } catch {
            toast.error("Não foi possível copiar. Selecione o ID na Administração.")
          }
        }}
        className="group hidden items-center gap-1.5 rounded-sm px-1 py-0.5 hover:text-rail-foreground sm:inline-flex"
        title="Copiar ID da sandbox"
      >
        <span className="sku">{formatSandboxId(sandbox.id)}</span>
        <CopyIcon className="size-3.5 opacity-60 group-hover:opacity-100" weight="bold" />
        <span className="sr-only">Copiar ID da sandbox</span>
      </button>
      <span className="inline-flex items-center gap-1.5">
        <HourglassMediumIcon className="size-3.5" weight="bold" />
        <span className="hidden sm:inline">Expira em</span>
        <Countdown to={sandbox.expiresAt} className="font-semibold text-rail-foreground" />
      </span>
      <span className="hidden text-rail-muted xl:inline">Nada aqui afeta outros visitantes.</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-sm px-2 font-semibold text-rail-foreground hover:bg-rail-raised aria-expanded:bg-rail-raised"
          >
            <span className="hidden sm:inline text-rail-muted font-normal">Perfil:</span>
            {ROLE_LABEL[role]}
            <CaretDownIcon className="size-3.5" weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[13px] font-normal text-muted-foreground">
            Trocar de perfil mantém todos os dados da sandbox.
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={async () => {
              const result = await login(other)
              if (result.ok) toast.success(`Agora você está como ${ROLE_LABEL[other]}`)
              else toast.error("Não foi possível trocar de perfil", { description: result.message })
            }}
          >
            <UserSwitchIcon weight="bold" />
            Trocar para {ROLE_LABEL[other]}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* The (app) guard takes over: /entrar, then back to this same area. */}
          <DropdownMenuItem onSelect={logout}>
            <SignOutIcon weight="bold" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function RailContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { explainLocked } = useOverlays()

  return (
    <>
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/painel" onClick={onNavigate} className="rounded-sm">
          <Logo />
          <span className="sr-only">Ir para o Painel</span>
        </Link>
      </div>
      <nav aria-label="Áreas" className="flex-1 px-3">
        <ul className="grid gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            const allowed = !item.requires || PERMISSIONS[role][item.requires]
            const Icon = item.icon
            const inner = (
              <>
                <Icon
                  className={cn("size-5", active ? "text-rail-foreground" : "text-rail-muted")}
                  weight={active ? "fill" : "regular"}
                />
                <span className="flex-1">{item.label}</span>
                {!allowed ? <LockSimpleIcon className="size-4 text-rail-muted" weight="bold" /> : null}
              </>
            )
            const cls = cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] transition-colors duration-150",
              active
                ? "bg-rail-raised font-semibold text-rail-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)]"
                : "text-[#cfd5d3] hover:bg-white/[0.05] hover:text-rail-foreground",
            )
            return (
              <li key={item.href}>
                {allowed ? (
                  <Link
                    href={item.href}
                    className={cls}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cls}
                    onClick={() => explainLocked(item.requires!)}
                    aria-label={`${item.label}: exclusivo do Administrador`}
                  >
                    {inner}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="m-3 rounded-lg bg-rail-raised p-3.5 text-[13px] text-rail-muted">
        <p className="font-semibold text-rail-foreground">Atalhos</p>
        <dl className="mt-2.5 grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <dt>Registrar movimentação</dt>
            <dd>
              <Kbd tone="onRail">M</Kbd>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt>Buscar produto</dt>
            <dd>
              <Kbd tone="onRail">/</Kbd>
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}

function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="-ml-1 inline-flex size-8 items-center justify-center rounded-sm text-rail-foreground hover:bg-rail-raised lg:hidden"
        >
          <ListIcon className="size-5" weight="bold" />
          <span className="sr-only">Abrir menu</span>
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="on-rail w-[280px] gap-0 border-r-0 bg-rail p-0 text-rail-foreground">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Áreas do Estoca</SheetDescription>
        <div className="flex h-full flex-col">
          <RailContent role={role} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Toolbar({ role }: { role: Role }) {
  const { openMovement } = useOverlays()
  return (
    <div className="sticky top-10 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur-[2px] supports-[backdrop-filter]:bg-background/85 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3">
        <React.Suspense fallback={<div className="h-10 flex-1 rounded-md border border-input bg-card" />}>
          <ReadField />
        </React.Suspense>
        <Button variant="trigger" onClick={() => openMovement()} className="h-10 shrink-0">
          <span className="hidden sm:inline">Registrar movimentação</span>
          <span className="sm:hidden">Movimentar</span>
          <Kbd tone="onTrigger" className="hidden sm:inline-flex">
            M
          </Kbd>
        </Button>
        <span className="sr-only">Perfil atual: {ROLE_LABEL[role]}</span>
      </div>
    </div>
  )
}

function Shortcuts() {
  const { openMovement } = useOverlays()
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=menu], [role=listbox]"))
        return
      if (document.querySelector("[role=dialog][data-state=open], [role=alertdialog][data-state=open]")) return
      if (e.key === "m" || e.key === "M") {
        e.preventDefault()
        openMovement()
      } else if (e.key === "/") {
        e.preventDefault()
        document.getElementById("read-field")?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openMovement])
  return null
}
