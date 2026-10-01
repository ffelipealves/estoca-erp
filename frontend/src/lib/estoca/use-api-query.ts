"use client"

import * as React from "react"
import { describeError } from "./store"

export type QueryStatus = "loading" | "error" | "ready"

/**
 * A read for one screen. A new `load` identity (new inputs) or a new
 * `refreshKey` (data changed elsewhere) refetches, keeping the previous data on
 * screen instead of flashing the skeleton again.
 */
export function useApiQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  fallback: string,
  refreshKey: unknown = null,
) {
  const [state, setState] = React.useState<{ status: QueryStatus; data: T | null; error: string | null }>({
    status: "loading",
    data: null,
    error: null,
  })
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(
      (data) => setState({ status: "ready", data, error: null }),
      (error) => {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, status: "error", error: describeError(error, fallback) }))
      },
    )
    return () => controller.abort()
  }, [load, attempt, fallback, refreshKey])

  const retry = React.useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: null }))
    setAttempt((a) => a + 1)
  }, [])

  return { ...state, retry }
}
