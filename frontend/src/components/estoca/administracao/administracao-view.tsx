"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  LockSimpleIcon,
  MinusIcon,
} from "@phosphor-icons/react"
import { listStockMovements } from "@/lib/api"
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-users"
import { useActions, useEstoca, useRole } from "@/lib/estoca/store"
import { PERMISSIONS, PERMISSION_ROWS, ROLE_LABEL, SEED_COUNTS } from "@/lib/estoca/rules"
import {
  formatDateTime,
  formatDuration,
  formatRelative,
  formatSandboxId,
  formatTime,
  pluralize,
} from "@/lib/estoca/format"
import type { Role } from "@/lib/estoca/types"
import { useApiQuery } from "@/lib/estoca/use-api-query"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader, Panel } from "../page-header"
import { Countdown, useNow } from "../countdown"

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} copiado`)
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.")
  }
}

/** How long a sandbox may live at most, whatever the activity. */
function maxAgeMs(sandbox: { createdAt: string; maxExpiresAt: string }) {
  return new Date(sandbox.maxExpiresAt).getTime() - new Date(sandbox.createdAt).getTime()
}

/** The sandbox's movement count, read again whenever one lands. */
function useMovementCount() {
  const { movementsVersion } = useEstoca()
  const query = useApiQuery(loadCount, "Não foi possível contar as movimentações.", movementsVersion)
  return query.data
}
const loadCount = (signal: AbortSignal) => listStockMovements(1, 1, {}, signal).then((page) => page.total)

export function AdministracaoView() {
  const role = useRole()
  if (role !== "admin") return <LockedAdmin />
  return <AdminContent />
}

function LockedAdmin() {
  const { login } = useActions()
  return (
    <>
      <PageHeader title="Administração" />
      <div className="max-w-2xl rounded-lg border bg-card px-6 py-8">
        <span className="inline-flex size-10 items-center justify-center rounded-md bg-rail text-rail-foreground">
          <LockSimpleIcon className="size-5" weight="bold" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Esta área é exclusiva do Administrador</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Aqui ficam o ID da sandbox, as credenciais de demonstração e o reset que apaga as alterações. Como
          Operador, você consulta tudo e registra movimentações, mas não administra a sandbox.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const result = await login("admin")
              if (result.ok) toast.success("Agora você está como Administrador")
              else toast.error("Não foi possível trocar de perfil", { description: result.message })
            }}
          >
            Trocar para Administrador
          </Button>
          <Button asChild variant="outline">
            <Link href="/painel">Voltar ao Painel</Link>
          </Button>
        </div>
      </div>
    </>
  )
}

function AdminContent() {
  const { sandbox, categories, products } = useEstoca()
  const movementCount = useMovementCount()
  const now = useNow()
  // A fresh key per open: each confirmation starts unlocked.
  const [reset, setReset] = React.useState({ open: false, key: 0 })

  return (
    <>
      <PageHeader
        title="Administração"
        description="Esta sandbox foi criada quando você abriu a demonstração. É isolada: nada daqui aparece para outros visitantes, e ela se apaga sozinha no fim do prazo."
      />

      <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
        <section
          aria-labelledby="prazo-titulo"
          className="on-rail flex flex-col justify-between gap-6 rounded-lg bg-rail px-6 py-6 text-rail-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)] sm:px-8 sm:py-7 lg:col-span-7"
        >
          <div>
            <h2 id="prazo-titulo" className="text-[15px] font-semibold text-rail-muted">
              Tempo até a sandbox expirar
            </h2>
            <p className="readout mt-4 text-[64px] text-rail-foreground sm:text-[104px] lg:text-[120px]">
              <Countdown to={sandbox.expiresAt} />
            </p>
          </div>
          <p className="max-w-[52ch] text-sm leading-relaxed text-rail-muted">
            Expira às <strong className="text-rail-foreground">{formatTime(sandbox.expiresAt)}</strong> de{" "}
            {formatDateTime(sandbox.expiresAt).slice(0, 10)} se ninguém usar até lá. Cada ação renova o prazo de{" "}
            {formatDuration(sandbox.inactivityMs)}, até o limite de {formatDateTime(sandbox.maxExpiresAt)}. Ao expirar,
            os dados são apagados.
          </p>
        </section>

        <Panel id="identidade" title="Identidade da sandbox" className="lg:col-span-5" bodyClassName="px-5 pb-5">
          <dl className="grid gap-4 text-[15px]">
            <div>
              <dt className="text-[13px] text-muted-foreground">ID</dt>
              <dd className="mt-1 flex items-center gap-2">
                <code className="sku rounded-sm bg-well px-2 py-1 text-[15px] font-semibold">{sandbox.id}</code>
                <Button variant="outline" size="sm" onClick={() => copy(sandbox.id, "ID da sandbox")}>
                  <CopyIcon weight="bold" />
                  Copiar
                </Button>
              </dd>
              <dd className="mt-1 text-[13px] text-muted-foreground">
                Exibido como {formatSandboxId(sandbox.id)} na barra superior.
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[13px] text-muted-foreground">Criada em</dt>
                <dd className="mt-1 font-semibold tabular-nums">{formatDateTime(sandbox.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted-foreground">Última atividade</dt>
                <dd className="mt-1 font-semibold" suppressHydrationWarning>
                  {now ? formatRelative(sandbox.lastActivityAt, now) : formatDateTime(sandbox.lastActivityAt)}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">Conteúdo agora</dt>
              <dd className="mt-1">
                {pluralize(categories.length, "categoria", "categorias")}, {pluralize(products.length, "produto", "produtos")}
                {movementCount === null ? null : <>, {pluralize(movementCount, "movimentação", "movimentações")}</>}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel
          id="usuarios"
          title="Usuários de demonstração"
          meta="Credenciais públicas, iguais para todos os visitantes. Cada visitante entra na própria sandbox."
          className="lg:col-span-7"
        >
          <ul className="divide-y border-t">
            {DEMO_USERS.map((u) => (
              <li key={u.role} className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
                <p className="font-bold">{ROLE_LABEL[u.role]}</p>
                <dl className="grid gap-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 text-muted-foreground">E-mail</dt>
                    <dd className="truncate font-medium">{u.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0 text-muted-foreground">Senha</dt>
                    <dd className="sku font-medium">{DEMO_PASSWORD}</dd>
                  </div>
                </dl>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => copy(`${u.email}\n${DEMO_PASSWORD}`, "Credenciais")}
                >
                  <CopyIcon weight="bold" />
                  Copiar
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="permissoes" title="Permissões por perfil" className="lg:col-span-5">
          <PermissionMatrix />
        </Panel>

        <section
          aria-labelledby="reset-titulo"
          className="flex flex-col gap-5 rounded-lg border border-[#e2b9af] bg-card px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:col-span-12"
        >
          <div className="max-w-[72ch]">
            <h2 id="reset-titulo" className="text-base font-bold">
              Resetar sandbox
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
              Apaga todos os produtos, categorias e movimentações desta sandbox e recria o catálogo inicial. Seu login, o
              ID e o limite de {formatDuration(maxAgeMs(sandbox))} desde a criação continuam os mesmos.
            </p>
          </div>
          <Button variant="destructive" className="shrink-0 self-start sm:self-center" onClick={() => setReset((r) => ({ open: true, key: r.key + 1 }))}>
            <ArrowCounterClockwiseIcon weight="bold" />
            Resetar sandbox
          </Button>
        </section>
      </div>

      <ResetDialog
        key={reset.key}
        open={reset.open}
        onOpenChange={(open) => setReset((r) => ({ ...r, open }))}
        movementCount={movementCount}
      />
    </>
  )
}

function PermissionMatrix() {
  const roles: Role[] = ["admin", "operador"]
  return (
    <table className="w-full border-t text-left text-sm">
      <thead className="bg-well text-[13px] text-muted-foreground">
        <tr>
          <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold">
            Função
          </th>
          {roles.map((r) => (
            <th key={r} scope="col" className="px-3 text-center font-semibold last:pr-5">
              {ROLE_LABEL[r]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {PERMISSION_ROWS.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="py-3 pr-3 pl-5 font-medium">
              {row.label}
            </th>
            {roles.map((r) => {
              const yes = PERMISSIONS[r][row.key]
              return (
                <td key={r} className="px-3 text-center last:pr-5">
                  <span
                    className={
                      yes
                        ? "inline-flex items-center gap-1 font-semibold"
                        : "inline-flex items-center gap-1 text-muted-foreground"
                    }
                  >
                    {yes ? (
                      <CheckIcon className="size-4 text-entrada" weight="bold" />
                    ) : (
                      <MinusIcon className="size-4" weight="bold" />
                    )}
                    {yes ? "Sim" : "Não"}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ResetDialog({
  open,
  onOpenChange,
  movementCount,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  movementCount: number | null
}) {
  const { resetSandbox } = useActions()
  const { sandbox, products, categories } = useEstoca()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inFlight = React.useRef(false)

  async function onConfirm() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const result = await resetSandbox()
    if (!result.ok) {
      inFlight.current = false
      setPending(false)
      setError(result.message)
      return
    }
    // Success keeps the dialog locked while the dialog fades out: a click in
    // that moment must not send it again. The next open starts a fresh dialog.

    onOpenChange(false)
    toast.success("Sandbox resetada", {
      description: `Catálogo inicial restaurado: ${pluralize(result.value.categories, "categoria", "categorias")} e ${pluralize(result.value.products, "produto", "produtos")}.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent busy={pending} role="alertdialog" className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Resetar a sandbox?</DialogTitle>
          <DialogDescription>O que você criou ou alterou aqui será perdido.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 text-[15px] sm:grid-cols-2">
          <div className="rounded-lg bg-danger-soft p-4 text-[#6e2213]">
            <p className="font-bold">Apaga agora</p>
            <ul className="mt-2 grid gap-1">
              <li>{pluralize(products.length, "produto", "produtos")}</li>
              <li>{pluralize(categories.length, "categoria", "categorias")}</li>
              {movementCount === null ? null : (
                <li>{pluralize(movementCount, "movimentação", "movimentações")}</li>
              )}
            </ul>
          </div>
          <div className="rounded-lg bg-well p-4">
            <p className="font-bold">Mantém</p>
            <ul className="mt-2 grid gap-1">
              <li>Seu login e perfil</li>
              <li>O ID da sandbox</li>
              <li>O limite de {formatDuration(maxAgeMs(sandbox))} desde a criação</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Depois do reset, o catálogo volta a ter {SEED_COUNTS.categories} categorias, {SEED_COUNTS.products} produtos
            e {SEED_COUNTS.movements} movimentações de exemplo.
          </p>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-[#7d2616] sm:col-span-2">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : <ArrowCounterClockwiseIcon weight="bold" />}
            {pending ? "Resetando…" : "Resetar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
