import { cn } from "@/lib/utils"

/** A key legend for a shortcut that actually works. */
export function Kbd({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode
  className?: string
  tone?: "light" | "onTrigger" | "onRail"
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-b-2 px-1 font-sans text-[11px] leading-none font-bold",
        tone === "light" && "border-input bg-card text-muted-foreground",
        tone === "onTrigger" && "border-black/25 bg-black/[0.07] text-trigger-ink",
        tone === "onRail" && "border-white/20 bg-white/[0.06] text-rail-muted",
        className,
      )}
    >
      {children}
    </kbd>
  )
}
