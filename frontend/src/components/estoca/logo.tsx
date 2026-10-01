import { cn } from "@/lib/utils"

/** Wordmark: condensed Archivo with the trigger-yellow read mark. */
export function Logo({ className, tone = "rail" }: { className?: string; tone?: "rail" | "ink" }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[3px] text-[22px] leading-none font-extrabold tracking-[-0.02em] select-none",
        tone === "rail" ? "text-rail-foreground" : "text-foreground",
        className,
      )}
      style={{ fontStretch: "70%" }}
    >
      Estoca
      <span aria-hidden className="inline-block size-[0.32em] rounded-[2px] bg-trigger" />
    </span>
  )
}
