"use client"

import { useSearchParams } from "next/navigation"
import * as React from "react"

/**
 * Filters live in the URL so a view can be shared or reloaded as is.
 * Writes go through the native history API: no server round trip.
 */
export function useUrlState() {
  const params = useSearchParams()
  const set = React.useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") sp.delete(key)
        else sp.set(key, value)
      }
      const qs = sp.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
    },
    [],
  )
  return [params, set] as const
}
