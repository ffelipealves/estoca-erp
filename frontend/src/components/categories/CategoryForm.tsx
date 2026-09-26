"use client";

import { useRef, useState, type FormEvent } from "react";

import { createCategory, updateCategory, type Category } from "@/lib/api";
import { describeMutationError } from "@/lib/permissions";

interface CategoryFormProps {
  category?: Category;
  onBusyChange?: (isBusy: boolean) => void;
  onCancel: () => void;
  onSaved: (category: Category) => void;
}

export function CategoryForm({
  category,
  onBusyChange,
  onCancel,
  onSaved,
}: CategoryFormProps) {
  const isEditing = Boolean(category);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  // O estado só atualiza no próximo render; a ref fecha a janela entre dois
  // envios disparados na mesma tarefa (ex.: Enter repetido).
  const submitLock = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setErrorMessage(null);
    setIsSubmitting(true);
    onBusyChange?.(true);

    try {
      const saved = category
        ? await updateCategory(category.id, name.trim())
        : await createCategory(name.trim());
      onSaved(saved);
    } catch (error: unknown) {
      setErrorMessage(
        describeMutationError(
          error,
          `Não foi possível ${isEditing ? "salvar a categoria" : "cadastrar a categoria"}. Verifique a conexão e tente novamente.`,
        ),
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
      onBusyChange?.(false);
    }
  }

  return (
    <form className="px-5 py-6 sm:px-7" onSubmit={handleSubmit}>
      <div className="pr-9">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
          {isEditing ? `Editando · ${category?.name}` : "Nova categoria"}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-[#17201d]">
          {isEditing ? "Editar categoria" : "Cadastrar categoria"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {isEditing
            ? "Renomear não altera os produtos vinculados a ela."
            : "Categorias organizam os produtos e facilitam a consulta do estoque."}
        </p>
      </div>

      <label className="mt-6 block">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
          Nome da categoria
        </span>
        <input
          className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:cursor-wait disabled:bg-stone-100"
          disabled={isSubmitting}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Bebidas"
          required
          value={name}
        />
      </label>

      {errorMessage ? (
        <p
          className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#17201d] px-5 text-sm font-bold text-white shadow-[0_3px_0_#0f8a5f] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? isEditing
              ? "Salvando..."
              : "Cadastrando..."
            : isEditing
              ? "Salvar alterações"
              : "Cadastrar categoria"}
        </button>
        <button
          className="h-11 px-3 text-sm font-semibold text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
