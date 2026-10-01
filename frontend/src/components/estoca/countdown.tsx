"use client"

import * as React from "react"
import { formatCountdown } from "@/lib/estoca/format"
import { cn } from "@/lib/utils"

function subscribeSecond(callback: () => void) {
  const id = setInterval(callback, 1000)
  return () => clearInterval(id)
}

/** Re-renders once per second, only where it is mounted. */
export function useNow(enabled = true) {
  return React.useSyncExternalStore(
    enabled ? subscribeSecond : () => () => {},
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  )
}

export function Countdown({ to, className }: { to: string; className?: string }) {
  const now = useNow()
  const ms = new Date(to).getTime() - now
  return (
    <time dateTime={to} className={cn("tabular-nums", className)} suppressHydrationWarning>
      {now === 0 ? "--:--:--" : formatCountdown(ms)}
    </time>
  )
}
