"use client";

import type { ReactNode } from "react";

interface HelpButtonProps {
  /** Id do painel que este botão revela. */
  controls: string;
  isOpen: boolean;
  /** Nome do campo, para o rótulo acessível. */
  label: string;
  onClick: () => void;
}

/**
 * Botão "?" ao lado do rótulo de um campo.
 *
 * É clique, não hover: hover não existe no toque, e a ajuda ficaria
 * inalcançável no celular. O `preventDefault` impede que o clique dentro de um
 * `<label>` acabe ativando o campo associado.
 *
 * O texto fica num painel separado, fora da coluna do campo — dentro dela o
 * texto forçaria a largura mínima da coluna e estouraria o grid.
 */
export function HelpButton({ controls, isOpen, label, onClick }: HelpButtonProps) {
  return (
    <button
      aria-controls={controls}
      aria-expanded={isOpen}
      aria-label={`O que é ${label}`}
      className={`grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-bold leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
        isOpen
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-stone-400 text-stone-500 hover:border-stone-600 hover:text-stone-800"
      }`}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      type="button"
    >
      ?
    </button>
  );
}

export function HelpPanel({ children, id }: { children: ReactNode; id: string }) {
  return (
    <p
      className="rounded-lg border border-stone-300 bg-white/80 px-3 py-2 text-xs leading-5 text-stone-600"
      id={id}
    >
      {children}
    </p>
  );
}
