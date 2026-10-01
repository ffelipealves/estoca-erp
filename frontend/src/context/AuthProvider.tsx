"use client"

import { useMaybeEstoca } from "@/lib/estoca/store"

/**
 * Legado: as telas anteriores ao redesign só leem o usuário logado. A sessão e
 * o login agora vivem em `lib/estoca/store`. Sai junto com elas (etapa F10).
 */
export function useAuth() {
  return { user: useMaybeEstoca()?.user ?? null }
}
