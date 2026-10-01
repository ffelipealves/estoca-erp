"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckIcon,
  CircleNotchIcon,
  CubeIcon,
  HourglassMediumIcon,
  LockSimpleIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react"
import { useActions, useEstoca } from "@/lib/estoca/store"
import { DEMO_PASSWORD, DEMO_USERS, demoUserFor } from "@/lib/demo-users"
import { PERMISSIONS, PERMISSION_ROWS, ROLE_LABEL, SEED_COUNTS } from "@/lib/estoca/rules"
import { formatSandboxId } from "@/lib/estoca/format"
import type { Role } from "@/lib/estoca/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/estoca/logo"
import { Countdown } from "@/components/estoca/countdown"
import { cn } from "@/lib/utils"

/** Only same-site paths: `?next=` must never send the visitor elsewhere. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/painel"
}

export function LoginView() {
  const { sandbox, role: currentRole } = useEstoca()
  const { signIn } = useActions()
  const router = useRouter()
  const next = safeNext(useSearchParams().get("next"))
  const [role, setRole] = React.useState<Role>("admin")
  const [email, setEmail] = React.useState(demoUserFor("admin").email)
  const [password, setPassword] = React.useState(DEMO_PASSWORD)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (currentRole) router.replace(next)
  }, [currentRole, next, router])

  function choose(nextRole: Role) {
    setRole(nextRole)
    setEmail(demoUserFor(nextRole).email)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    const result = await signIn({ email, password })
    if (!result.ok) {
      setPending(false)
      setError(
        result.field === "credentials"
          ? `${result.message}. Escolha o perfil de novo para restaurar as credenciais de demonstração.`
          : result.message,
      )
    }
    // On success the role appears in the store and the effect above leaves the page.
  }

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="on-rail flex flex-col bg-rail px-5 pt-6 pb-8 text-rail-foreground sm:px-10 lg:px-12 lg:py-10">
        <Logo />
        <div className="mt-10 flex flex-1 flex-col lg:mt-0 lg:justify-center">
          <h1
            className="max-w-[12ch] text-[40px] leading-[0.95] font-extrabold tracking-[-0.025em] sm:text-[52px]"
            style={{ fontStretch: "78%" }}
          >
            Explore sem medo.
          </h1>
          <p className="mt-5 max-w-[42ch] text-[15px] leading-relaxed text-rail-muted sm:text-base">
            Esta é uma sandbox só sua. Nada do que você fizer aqui afeta outros visitantes, e tudo é apagado
            sozinho quando o tempo acabar.
          </p>

          <dl className="mt-9 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/10">
            <div className="bg-rail-raised px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-[13px] text-rail-muted">
                <ShieldCheckIcon className="size-3.5" weight="bold" />
                Sandbox
              </dt>
              <dd className="readout mt-1.5 text-[26px]">{formatSandboxId(sandbox.id)}</dd>
            </div>
            <div className="bg-rail-raised px-4 py-3.5">
              <dt className="flex items-center gap-1.5 text-[13px] text-rail-muted">
                <HourglassMediumIcon className="size-3.5" weight="bold" />
                Expira em
              </dt>
              <dd className="readout mt-1.5 text-[26px]">
                <Countdown to={sandbox.expiresAt} />
              </dd>
            </div>
            <div className="col-span-2 flex items-center gap-2.5 bg-rail-raised px-4 py-3 text-sm text-rail-muted">
              <CubeIcon className="size-4 shrink-0" weight="bold" />
              Começa com {SEED_COUNTS.categories} categorias, {SEED_COUNTS.products} produtos e{" "}
              {SEED_COUNTS.movements} movimentações.
            </div>
          </dl>
        </div>
      </section>

      <section className="flex items-center px-5 py-10 sm:px-10 lg:px-16">
        <form onSubmit={onSubmit} className="w-full max-w-[520px]" noValidate>
          <h2 className="text-2xl font-bold tracking-[-0.015em]">Escolha um perfil</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
            As credenciais já vêm preenchidas. Dá para trocar de perfil depois, sem perder os dados.
          </p>

          <fieldset className="mt-7 grid gap-3">
            <legend className="sr-only">Perfil de demonstração</legend>
            {DEMO_USERS.map((u) => {
              const selected = u.role === role
              const restricted = PERMISSION_ROWS.some((r) => !PERMISSIONS[u.role][r.key])
              return (
                <label
                  key={u.role}
                  className={cn(
                    "relative flex cursor-pointer gap-4 rounded-lg border bg-card p-4 transition-[border-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    selected
                      ? "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]"
                      : "border-input hover:border-[#9aa4a1]",
                  )}
                >
                  <input
                    type="radio"
                    name="perfil"
                    value={u.role}
                    checked={selected}
                    onChange={() => choose(u.role)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm border",
                      selected ? "border-rail bg-rail text-rail-foreground" : "border-input bg-secondary",
                    )}
                  >
                    {selected ? <CheckIcon className="size-3.5" weight="bold" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold">{ROLE_LABEL[u.role]}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{u.summary}</span>
                    {restricted ? (
                      <span className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                        <LockSimpleIcon className="size-3.5" weight="bold" />
                        Sem gestão de catálogo e sem Administração
                      </span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </fieldset>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="text"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby="password-hint"
              />
            </div>
          </div>
          <p id="password-hint" className="mt-2 text-[13px] text-muted-foreground">
            Senha visível de propósito: são contas de demonstração.
          </p>
          {error ? (
            <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-[#7d2616]">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="trigger" size="lg" className="mt-7 w-full sm:w-auto" disabled={pending}>
            {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : null}
            {pending ? "Entrando…" : `Entrar como ${ROLE_LABEL[role]}`}
          </Button>
        </form>
      </section>
    </div>
  )
}
