"use client";

import type { ReactNode } from "react";

interface AdminActionProps {
  ariaExpanded?: boolean;
  blockedClassName: string;
  children: ReactNode;
  className: string;
  isAdmin: boolean;
  onBlocked: () => void;
  onClick: () => void;
}

/**
 * Controle de mutação que permanece visível para o operador em vez de sumir.
 * Bloqueado, ele fica com aparência apagada, cadeado e `aria-disabled`, e o
 * clique explica a restrição — o que preserva a evidência de que o RBAC existe.
 * Não usamos `disabled` justamente para que o clique ainda produza resposta.
 */
export function AdminAction({
  ariaExpanded,
  blockedClassName,
  children,
  className,
  isAdmin,
  onBlocked,
  onClick,
}: AdminActionProps) {
  if (isAdmin) {
    return (
      <button
        aria-expanded={ariaExpanded}
        className={className}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      aria-disabled="true"
      className={blockedClassName}
      onClick={onBlocked}
      title="Somente administrador"
      type="button"
    >
      <svg
        aria-hidden="true"
        className="size-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
        viewBox="0 0 24 24"
      >
        <path d="M6.5 10.5h11v9h-11z" />
        <path d="M9 10.5V7.8a3 3 0 0 1 6 0v2.7" />
      </svg>
      {children}
    </button>
  );
}
