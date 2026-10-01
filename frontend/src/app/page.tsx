"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useEstoca } from "@/lib/estoca/store"

export default function Home() {
  const { role } = useEstoca()
  const router = useRouter()
  useEffect(() => {
    router.replace(role ? "/painel" : "/entrar")
  }, [role, router])
  return null
}
