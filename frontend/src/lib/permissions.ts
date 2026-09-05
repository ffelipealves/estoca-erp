import { ApiError } from "@/lib/api";

/**
 * Mostrada quando o operador aciona um controle que o backend reserva ao
 * administrador. O texto aponta a saída (trocar de usuário) em vez de só
 * informar o bloqueio.
 */
export const ADMIN_ONLY_NOTICE =
  "Esta ação é restrita ao administrador. Use “Trocar usuário” no menu lateral e entre com admin@estoca.demo para liberar o cadastro.";

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * O backend responde 403 mesmo que a interface seja contornada — nesse caso a
 * mensagem genérica da API não diz ao usuário o que fazer, então trocamos pela
 * orientação de permissão.
 */
export function describeMutationError(error: unknown, fallback: string): string {
  if (isForbidden(error)) return ADMIN_ONLY_NOTICE;
  if (error instanceof ApiError) return error.message;
  return fallback;
}
