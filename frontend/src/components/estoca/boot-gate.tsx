"use client"

import { CheckIcon, CircleNotchIcon, ShieldCheckIcon, WarningOctagonIcon } from "@phosphor-icons/react"
import { BOOT_STEPS, useActions, useBoot, useMaybeEstoca } from "@/lib/estoca/store"
import { SEED_COUNTS } from "@/lib/estoca/rules"
import { Button } from "@/components/ui/button"
import { Logo } from "./logo"
import { cn } from "@/lib/utils"

export function BootGate({ children }: { children: React.ReactNode }) {
  const boot = useBoot()
  const state = useMaybeEstoca()

  if (boot.status === "booting" || boot.status === "error" || !state) {
    return <BootScreen />
  }
  return (
    <>
      {children}
      {boot.status === "expired" ? <ExpiredScreen /> : null}
    </>
  )
}

const STEP_DETAIL = [
  "O servidor gratuito hiberna sem uso. O primeiro acesso pode levar cerca de um minuto.",
  `Um espaço só seu, já com ${SEED_COUNTS.categories} categorias, ${SEED_COUNTS.products} produtos e ${SEED_COUNTS.movements} movimentações de exemplo. Nada do que você fizer aparece para outros visitantes.`,
  "O prazo renova a cada ação: 2 horas sem uso, e no máximo 24 horas desde a criação.",
]

function BootScreen() {
  const { status, mode, step, error } = useBoot()
  const { retryBoot } = useActions()
  const failed = status === "error"

  return (
    <main className="on-rail flex min-h-[100dvh] flex-col bg-rail px-5 py-8 text-rail-foreground sm:px-12 sm:py-12">
      <Logo />
      <div className="flex flex-1 items-center">
        <div className="w-full max-w-md py-10" aria-live="polite">
          {mode === "restaurando" && !failed ? (
            <>
              <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em]">
                Restaurando sua sandbox
              </h1>
              <p className="mt-3 flex items-center gap-2 text-rail-muted">
                <CircleNotchIcon className="size-4 animate-spin" weight="bold" />
                Seus dados continuam onde você deixou.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[34px]">
                {failed ? "O servidor não respondeu" : "Preparando sua sandbox"}
              </h1>
              <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-rail-muted">
                {failed
                  ? "A demonstração não conseguiu acordar a API a tempo. Isso costuma resolver na segunda tentativa."
                  : "Explore sem medo: seus dados são isolados e temporários."}
              </p>

              {failed ? (
                <div className="mt-8 flex flex-col gap-4">
                  <p className="flex items-start gap-3 rounded-lg bg-rail-raised px-4 py-3 text-sm text-rail-foreground">
                    <WarningOctagonIcon className="mt-0.5 size-5 shrink-0 text-rail-foreground" weight="fill" />
                    {error}
                  </p>
                  <Button variant="trigger" size="lg" className="self-start" onClick={retryBoot}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <ol className="mt-9 flex flex-col gap-5">
                  {BOOT_STEPS.map((label, i) => {
                    const done = i < step
                    const current = i === step
                    return (
                      <li key={label} className="flex gap-3.5">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm border",
                            done && "border-rail-foreground bg-rail-foreground text-rail",
                            current && "border-white/25 bg-rail-raised text-rail-foreground",
                            !done && !current && "border-white/10 bg-transparent text-rail-muted",
                          )}
                        >
                          {done ? (
                            <CheckIcon className="size-3.5" weight="bold" />
                          ) : current ? (
                            <CircleNotchIcon className="size-3.5 animate-spin" weight="bold" />
                          ) : (
                            <span className="size-1.5 rounded-full bg-current" />
                          )}
                        </span>
                        <div className={cn(!done && !current && "opacity-55")}>
                          <p className="font-semibold">{label}</p>
                          <p className="mt-1 text-sm leading-relaxed text-rail-muted">{STEP_DETAIL[i]}</p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-rail-muted">
        <ShieldCheckIcon className="size-4" weight="bold" />
        A sandbox expira após 2 horas sem uso.
      </p>
    </main>
  )
}

function ExpiredScreen() {
  const { startNewSandbox } = useActions()
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="expired-title"
      className="on-rail fixed inset-0 z-[70] flex items-center bg-rail/95 px-5 text-rail-foreground sm:px-12"
    >
      <div className="max-w-md">
        <Logo />
        <h1 id="expired-title" className="mt-10 text-[30px] leading-tight font-bold tracking-[-0.02em]">
          Sua sandbox expirou
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-rail-muted">
          Ela ficou 2 horas sem uso ou chegou ao limite de 24 horas, e os dados foram apagados, como
          prometido. Uma nova sandbox começa com o catálogo inicial, e você volta com o mesmo perfil.
        </p>
        <Button variant="trigger" size="lg" className="mt-8" onClick={startNewSandbox} autoFocus>
          Criar nova sandbox
        </Button>
      </div>
    </div>
  )
}
