"use client"

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

/**
 * Digits roll into place like a collector display updating.
 * Keyed by position from the right so units stay put when length changes.
 */
export function RollingNumber({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion()
  const chars = value.split("")
  return (
    <LazyMotion features={domAnimation} strict>
      <span className={cn("inline-flex", className)} aria-hidden>
        {chars.map((ch, i) => (
          <span key={chars.length - i} className="relative inline-block overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              <m.span
                key={ch}
                className="inline-block"
                initial={reduce ? false : { y: "-70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? undefined : { y: "70%", opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                {ch}
              </m.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </LazyMotion>
  )
}
