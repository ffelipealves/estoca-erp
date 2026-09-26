"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  children: ReactNode;
  /** Falso enquanto uma operação está em andamento: Esc e clique fora não fecham. */
  dismissible?: boolean;
  /** Nome acessível do diálogo. */
  label: string;
  onClose: () => void;
}

/**
 * Diálogo modal sobre `<dialog>` nativo: o navegador cuida da camada superior,
 * do foco preso dentro dele, do fundo inerte e da tecla Esc. Montar o
 * componente abre o modal; desmontar fecha.
 */
export function Modal({ children, dismissible = true, label, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Desmontar não dispara o retorno de foco nativo do `close()`.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.showModal();

    return () => {
      dialog.close();
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <dialog
      aria-label={label}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-stone-300 bg-[#fffdf8] p-0 text-stone-900 shadow-[0_24px_70px_rgba(23,32,29,0.35)] backdrop:bg-stone-950/55 backdrop:backdrop-blur-[2px]"
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
      {children}
    </dialog>
  );
}
