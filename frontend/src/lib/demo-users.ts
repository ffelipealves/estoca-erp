import type { UserRole } from "@/lib/api";

export const DEMO_PASSWORD = "demo123";

export interface DemoUserProfile {
  description: string;
  email: string;
  label: string;
  role: UserRole;
}

export const DEMO_USERS: readonly DemoUserProfile[] = [
  {
    description: "Acesso completo para cadastrar e editar o catálogo.",
    email: "admin@estoca.demo",
    label: "Administrador",
    role: "admin",
  },
  {
    description: "Acesso operacional para consultar e movimentar o estoque.",
    email: "operador@estoca.demo",
    label: "Operador",
    role: "operador",
  },
];
