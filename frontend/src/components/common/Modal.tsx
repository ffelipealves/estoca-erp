"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  /** Falso enquanto uma operação está em andamento: Esc e clique fora não fecham. */
  dismissible?: boolean;
  /** Nome acessível do diálogo. */
  label: string;
  onClose: () => void;
  /** `lg` para formulários com várias colunas. */
  size?: "md" | "lg";
}

/**
 * Diálogo modal sobre `<dialog>` nativo: o navegador cuida da camada superior,
 * do foco preso dentro dele, do fundo inerte e da tecla Esc. Montar o
 * componente abre o modal; desmontar fecha. Por padrão o foco vai ao primeiro
 * controle do conteúdo; marque outro com `data-autofocus`.
 */
export function Modal({
  children,
  dismissible = true,
  label,
  onClose,
  size = "md",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Desmontar não dispara o retorno de foco nativo do `close()`.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // Foco explícito: `autoFocus` do React roda antes de o diálogo abrir, e em
    // telas baixas o navegador escolheria a própria área rolável como primeiro alvo.
    const content = contentRef.current;
    (
      content?.querySelector<HTMLElement>("[data-autofocus]") ??
      content?.querySelector<HTMLElement>("input, select, textarea, button")
    )?.focus();

    return () => {
      dialog.close();
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <dialog
      aria-label={label}
      className={`relative m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-4xl" : "max-w-2xl"} overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] p-0 text-stone-900 shadow-[0_24px_70px_rgba(23,32,29,0.35)] backdrop:bg-stone-950/55 backdrop:backdrop-blur-[2px]`}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      // Só fecha se o clique começou e terminou no fundo: selecionar texto
      // dentro do formulário e soltar o mouse fora não pode fechar o modal.
      onMouseDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (
          dismissible &&
          pressStartedOnBackdrop.current &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
      ref={dialogRef}
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto" ref={contentRef}>
        {children}
      </div>
      {/* Por último no DOM para que o primeiro foco caia no conteúdo, não no X. */}
      <button
        aria-label="Fechar"
        className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!dismissible}
        onClick={onClose}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </dialog>
  );
}
