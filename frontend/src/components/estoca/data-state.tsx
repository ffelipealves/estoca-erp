"use client"

import { ArrowClockwiseIcon, FunnelXIcon, WarningOctagonIcon } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ErrorState({
  title = "Não foi possível carregar",
  detail,
  onRetry,
  className,
}: {
  title?: string
  detail: string
  onRetry(): void
  className?: string
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-4 px-5 py-10 sm:px-8", className)}>
      <span className="inline-flex size-10 items-center justify-center rounded-md bg-danger-soft text-[#773226]">
        <WarningOctagonIcon className="size-5" weight="bold" />
      </span>
      <div>
        <p className="text-base font-bold">{title}</p>
        <p className="mt-1 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <ArrowClockwiseIcon weight="bold" />
        Tentar novamente
      </Button>
    </div>
  )
}

export function EmptyState({
  icon: IconCmp,
  title,
  children,
  action,
  className,
}: {
  icon: Icon
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-start gap-4 px-5 py-10 sm:px-8", className)}>
      <span className="inline-flex size-10 items-center justify-center rounded-md bg-well text-muted-foreground">
        <IconCmp className="size-5" weight="bold" />
      </span>
      <div>
        <p className="text-base font-bold">{title}</p>
        {children ? (
          <div className="mt-1 max-w-[56ch] text-sm leading-relaxed text-muted-foreground">{children}</div>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function FilteredEmpty({ onClear, what }: { onClear(): void; what: string }) {
  return (
    <EmptyState
      icon={FunnelXIcon}
      title={`Nenhum ${what} com esses filtros`}
      action={
        <Button variant="outline" onClick={onClear}>
          Limpar filtros
        </Button>
      }
    >
      Os dados existem, mas nenhum combina com a busca e os filtros atuais.
    </EmptyState>
  )
}
