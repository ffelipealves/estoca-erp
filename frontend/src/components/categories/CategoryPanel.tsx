"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "@/context/AuthProvider";
import {
  ApiError,
  createCategory,
  deleteCategory,
  listCategories,
  listProducts,
  updateCategory,
  type Category,
  type Product,
} from "@/lib/api";

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível carregar as categorias. Verifique a conexão e tente novamente.";
}

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR"),
  );
}

export function CategoryPanel() {
  const { user } = useAuth();
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [requestKey, setRequestKey] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void Promise.all([
      listCategories(controller.signal),
      listProducts(controller.signal),
    ])
      .then(([loadedCategories, loadedProducts]) => {
        if (!active) return;
        setCategories(sortCategories(loadedCategories));
        setProducts(loadedProducts);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setLoadErrorMessage(describeError(error));
        setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestKey]);

  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    });
    return counts;
  }, [products]);

  function reloadCategories() {
    setLoadErrorMessage(null);
    setIsLoading(true);
    setRequestKey((current) => current + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionErrorMessage(null);
    setIsSubmitting(true);

    try {
      const category = editingCategory
        ? await updateCategory(editingCategory.id, name.trim())
        : await createCategory(name.trim());
      setCategories((current) =>
        sortCategories(
          editingCategory
            ? current.map((item) => (item.id === category.id ? category : item))
            : [...current, category],
        ),
      );
      setName("");
      setEditingCategory(null);
      setShowCreateForm(false);
      setSuccessMessage(
        `${category.name} foi ${editingCategory ? "atualizada" : "adicionada ao catálogo"}.`,
      );
    } catch (error: unknown) {
      setActionErrorMessage(
        error instanceof ApiError
          ? error.message
          : `Não foi possível ${editingCategory ? "salvar a categoria" : "cadastrar a categoria"}. Verifique a conexão e tente novamente.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeForm() {
    setEditingCategory(null);
    setName("");
    setShowCreateForm(false);
  }

  function startEditing(category: Category) {
    setActionErrorMessage(null);
    setCategoryToDelete(null);
    setEditingCategory(category);
    setName(category.name);
    setShowCreateForm(true);
    setSuccessMessage(null);
  }

  async function handleDeleteCategory() {
    if (!categoryToDelete) return;

    setActionErrorMessage(null);
    setDeletingCategoryId(categoryToDelete.id);

    try {
      await deleteCategory(categoryToDelete.id);
      setCategories((current) =>
        current.filter((category) => category.id !== categoryToDelete.id),
      );
      setSuccessMessage(`${categoryToDelete.name} foi excluída do catálogo.`);
      setCategoryToDelete(null);
    } catch (error: unknown) {
      setActionErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível excluir a categoria. Verifique a conexão e tente novamente.",
      );
    } finally {
      setDeletingCategoryId(null);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]">
      <div className="flex flex-col gap-4 border-b border-dashed border-stone-300 bg-stone-100/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-stone-500">
            Etiquetas de prateleira · CAT-{String(categories.length).padStart(3, "0")}
          </p>
          <p className="mt-1 text-sm text-stone-600" aria-live="polite">
            {isLoading
              ? "Conferindo as classificações da sessão..."
              : `${categories.length} ${categories.length === 1 ? "categoria" : "categorias"} em uso`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {user?.role === "admin" ? (
            <button
              aria-expanded={showCreateForm}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#17201d] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_2px_0_#0f8a5f] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              onClick={() => {
                setActionErrorMessage(null);
                setCategoryToDelete(null);
                setEditingCategory(null);
                setName("");
                setSuccessMessage(null);
                setShowCreateForm((current) => !current);
              }}
              type="button"
            >
              {showCreateForm ? "Fechar ficha" : "+ Nova categoria"}
            </button>
          ) : null}
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-600 shadow-sm transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50"
            disabled={isLoading}
            onClick={reloadCategories}
            type="button"
          >
            Atualizar
          </button>
        </div>
      </div>

      {showCreateForm && user?.role === "admin" ? (
        <form
          className="border-b border-stone-300 bg-[#eef2e9] px-5 py-6 sm:px-6"
          onSubmit={handleSubmit}
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
            {editingCategory
              ? `Revisão de etiqueta · ${editingCategory.name}`
              : "Nova etiqueta · classificação"}
          </p>
          <div className="mt-3 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                Nome da categoria
              </span>
              <input
                autoFocus
                className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:cursor-wait disabled:bg-stone-100"
                disabled={isSubmitting}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Bebidas"
                required
                value={name}
              />
            </label>
            <button
              className="h-11 rounded-lg bg-[#17201d] px-5 text-sm font-bold text-white shadow-[0_3px_0_#0f8a5f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? editingCategory
                  ? "Salvando..."
                  : "Cadastrando..."
                : editingCategory
                  ? "Salvar alterações"
                  : "Cadastrar categoria"}
            </button>
            <button
              className="h-11 px-3 text-sm font-semibold text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              disabled={isSubmitting}
              onClick={closeForm}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {categoryToDelete && user?.role === "admin" ? (
        <div className="flex flex-col gap-4 border-b border-rose-200 bg-rose-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-rose-700">
              Descartar etiqueta · categoria vazia
            </p>
            <p className="mt-1 text-sm font-semibold text-rose-950">
              Excluir a categoria {categoryToDelete.name}?
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              className="h-9 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-wait disabled:opacity-60"
              disabled={deletingCategoryId === categoryToDelete.id}
              onClick={() => void handleDeleteCategory()}
              type="button"
            >
              {deletingCategoryId === categoryToDelete.id
                ? "Excluindo..."
                : "Excluir categoria"}
            </button>
            <button
              className="h-9 px-3 text-sm font-semibold text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
              disabled={deletingCategoryId === categoryToDelete.id}
              onClick={() => setCategoryToDelete(null)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {actionErrorMessage ? (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800 sm:px-6" role="alert">
          {actionErrorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-900 sm:px-6" role="status">
          {successMessage}
        </div>
      ) : null}

      {loadErrorMessage ? (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800 sm:px-6" role="alert">
          {loadErrorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3" aria-label="Carregando categorias" role="status">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="h-28 animate-pulse rounded-xl bg-stone-200/70" key={item} />
          ))}
        </div>
      ) : null}

      {!isLoading && !loadErrorMessage && categories.length === 0 ? (
        <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
          <div className="max-w-sm">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
              Catálogo sem etiquetas
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-[#17201d]">
              Crie a primeira categoria
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Categorias organizam os produtos e tornam a consulta do estoque mais rápida.
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && !loadErrorMessage && categories.length > 0 ? (
        <ul className="grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => {
            const productCount = productCountByCategory.get(category.id) ?? 0;

            return (
              <li className="group min-h-32 bg-[#fffdf8] p-5 transition hover:bg-white sm:p-6" key={category.id}>
                <div className="flex items-start justify-between gap-4">
                  <span className="grid size-10 place-items-center rounded-lg border border-stone-300 bg-stone-100 font-display text-xl font-bold text-stone-600 transition group-hover:border-emerald-700/30 group-hover:bg-emerald-50 group-hover:text-emerald-800">
                    {category.name.charAt(0).toLocaleUpperCase("pt-BR")}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400">
                    CAT-{String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-5 font-display text-2xl font-bold leading-none text-[#17201d]">
                  {category.name}
                </p>
                <p className="mt-2 text-xs text-stone-500">
                  {productCount} {productCount === 1 ? "produto vinculado" : "produtos vinculados"}
                </p>
                {user?.role === "admin" ? (
                  <div className="mt-5 flex items-center gap-3 border-t border-dashed border-stone-200 pt-4">
                    <button
                      className="text-xs font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                      onClick={() => startEditing(category)}
                      type="button"
                    >
                      Editar
                    </button>
                    {productCount === 0 ? (
                      <button
                        className="text-xs font-semibold text-rose-700 underline decoration-rose-700/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                        onClick={() => {
                          closeForm();
                          setActionErrorMessage(null);
                          setCategoryToDelete(category);
                          setSuccessMessage(null);
                        }}
                        type="button"
                      >
                        Excluir
                      </button>
                    ) : (
                      <span
                        className="font-mono text-[9px] font-semibold uppercase tracking-wider text-stone-400"
                        title="Remova ou transfira os produtos antes de excluir esta categoria"
                      >
                        Em uso · exclusão bloqueada
                      </span>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
