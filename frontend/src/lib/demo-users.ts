import type { Role } from "@/lib/estoca/types"

/** As contas de demonstração existem em toda sandbox, com a mesma senha. */
export const DEMO_PASSWORD = "demo123"

export interface DemoUser {
  role: Role
  email: string
  summary: string
}

export const DEMO_USERS: readonly DemoUser[] = [
  {
    role: "admin",
    email: "admin@estoca.demo",
    summary: "Gerencia catálogo e categorias, registra movimentações e pode resetar a sandbox.",
  },
  {
    role: "operador",
    email: "operador@estoca.demo",
    summary: "Consulta tudo e registra movimentações. Ações de gestão aparecem travadas.",
  },
]

export function demoUserFor(role: Role): DemoUser {
  return DEMO_USERS.find((user) => user.role === role) ?? DEMO_USERS[0]
}
