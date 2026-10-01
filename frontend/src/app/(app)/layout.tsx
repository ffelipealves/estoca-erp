"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useEstoca } from "@/lib/estoca/store"
import { InterimShell } from "./interim-shell"

/** Every area needs a login; a deep link comes back here after `/entrar`. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = useEstoca()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!role) router.replace(`/entrar?next=${encodeURIComponent(pathname)}`)
  }, [pathname, role, router])

  if (!role) return null
  return <InterimShell>{children}</InterimShell>
}
