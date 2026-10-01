import { WarningDiamondIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react"
import { URGENCY_LABEL, type Urgency } from "@/lib/estoca/rules"
import { cn } from "@/lib/utils"

const URGENCY_STYLE: Record<Urgency, { cls: string; icon: typeof WarningIcon }> = {
  zerado: { cls: "bg-danger-soft text-[#7d2616]", icon: XCircleIcon },
  critico: { cls: "bg-warn-soft text-warn", icon: WarningDiamondIcon },
  baixo: { cls: "bg-secondary text-foreground", icon: WarningIcon },
}

/** Stock status always ships as icon + word, never color alone. */
export function UrgencyTag({ urgency, className }: { urgency: Urgency; className?: string }) {
  const { cls, icon: Icon } = URGENCY_STYLE[urgency]
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-[12px] font-bold",
        cls,
        className,
      )}
    >
      <Icon className="size-3.5" weight="bold" />
      {URGENCY_LABEL[urgency]}
    </span>
  )
}
