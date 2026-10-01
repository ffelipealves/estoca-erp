"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarcodeIcon, XIcon } from "@phosphor-icons/react"
import { Kbd } from "../kbd"

/**
 * The collector's read field: type a name, SKU or category.
 * On Produtos it filters in place; anywhere else Enter jumps to the catalog.
 */
export function ReadField() {
  const pathname = usePathname()
  const params = useSearchParams()
  const router = useRouter()
  const onCatalog = pathname.startsWith("/produtos")
  const urlQuery = onCatalog ? (params.get("q") ?? "") : ""
  const [value, setValue] = React.useState(urlQuery)
  const [syncedFrom, setSyncedFrom] = React.useState(urlQuery)

  // Follow the URL when it changes elsewhere (filters cleared, navigation).
  if (urlQuery !== syncedFrom) {
    setSyncedFrom(urlQuery)
    setValue(urlQuery)
  }

  function commit(next: string, mode: "replace" | "push") {
    const sp = new URLSearchParams(onCatalog ? params.toString() : "")
    if (next.trim()) sp.set("q", next.trim())
    else sp.delete("q")
    sp.delete("pagina")
    const url = `/produtos${sp.size ? `?${sp}` : ""}`
    setSyncedFrom(next.trim())
    // Filtering in place: native history keeps useSearchParams in sync without a server round trip.
    if (mode === "replace") window.history.replaceState(null, "", url)
    else router.push(url)
  }

  return (
    <form
      role="search"
      className="relative flex min-w-0 flex-1 items-center"
      onSubmit={(e) => {
        e.preventDefault()
        commit(value, onCatalog ? "replace" : "push")
      }}
    >
      <label htmlFor="read-field" className="sr-only">
        Buscar produto, SKU ou categoria
      </label>
      <BarcodeIcon
        className="pointer-events-none absolute left-3 size-5 text-muted-foreground"
        weight="bold"
        aria-hidden
      />
      <input
        id="read-field"
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (onCatalog) commit(e.target.value, "replace")
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.target as HTMLInputElement).blur()
        }}
        placeholder="Buscar produto ou SKU"
        className="h-10 w-full min-w-0 rounded-md border border-input bg-card pr-9 pl-10 sm:pr-20 text-[15px] shadow-[inset_0_1px_0_rgb(27_31_34/0.05)] outline-none placeholder:text-[#6b7479] focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute right-2 flex items-center gap-1.5">
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("")
              if (onCatalog) commit("", "replace")
              document.getElementById("read-field")?.focus()
            }}
            className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <XIcon className="size-4" weight="bold" />
            <span className="sr-only">Limpar busca</span>
          </button>
        ) : (
          <Kbd className="hidden sm:inline-flex">/</Kbd>
        )}
        {!onCatalog && value ? <Kbd className="hidden sm:inline-flex">Enter</Kbd> : null}
      </span>
    </form>
  )
}
