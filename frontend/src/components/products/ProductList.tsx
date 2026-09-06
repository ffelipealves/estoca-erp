"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminAction } from "@/components/auth/AdminAction";
import { ProductForm } from "@/components/products/ProductForm";
import { InventorySummary } from "@/components/products/InventorySummary";
import { useAuth } from "@/context/AuthProvider";
import {
  ApiError,
  deleteProduct,
  listCategories,
  listProducts,
  type Category,
  type Product,
} from "@/lib/api";
import { ADMIN_ONLY_NOTICE, describeMutationError } from "@/lib/permissions";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível carregar o catálogo. Verifique a conexão e tente novamente.";
}

type SortKey = "name" | "category" | "price" | "quantity";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  category: "Categoria",
  name: "Produto",
  price: "Preço",
  quantity: "Saldo",
};

/** Mesma ordem das colunas da tabela, para o select do mobile não divergir. */
const SORT_ORDER: SortKey[] = ["name", "category", "price", "quantity"];

/**
 * Ordenamos no cliente de propósito: o teto é de 50 produtos por sessão e a
 * lista inteira já está em memória, então uma ida ao servidor por clique de
 * cabeçalho só adicionaria latência. Os filtros da API (`category_id`,
 * `search`, `low_stock`) seguem existindo para consumidores da API.
 */
function compareProducts(
  left: Product,
  right: Product,
  key: SortKey,
  categoryNameOf: (product: Product) => string,
): number {
  switch (key) {
    case "price":
      return Number(left.price) - Number(right.price);
    case "quantity":
      return left.quantity - right.quantity;
    case "category":
      return categoryNameOf(left).localeCompare(categoryNameOf(right), "pt-BR");
    default:
      return left.name.localeCompare(right.name, "pt-BR");
  }
}

function SortHeader({
  activeKey,
  direction,
  label,
  onToggle,
  sortKey,
}: {
  activeKey: SortKey;
  direction: SortDirection;
  label: string;
  onToggle: (key: SortKey) => void;
  sortKey: SortKey;
}) {
  const isActive = activeKey === sortKey;
  const ascending = isActive && direction === "asc";

  return (
    <button
      // A lista é um <ul>, não uma <table>, então não há papel de columnheader
      // onde `aria-sort` seria válido — o estado vai no rótulo acessível.
      aria-label={`${label}. ${
        isActive
          ? `Ordenado em ordem ${ascending ? "crescente" : "decrescente"}. Ativar para inverter.`
          : "Ativar para ordenar por esta coluna."
      }`}
      className={`group inline-flex items-center gap-1.5 text-left uppercase tracking-[0.16em] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
        isActive ? "text-emerald-800" : "hover:text-stone-800"
      }`}
      onClick={() => onToggle(sortKey)}
      type="button"
    >
      {label}
      <svg
        aria-hidden="true"
        className={`size-3 shrink-0 transition ${
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-40"
        } ${isActive && !ascending ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
        viewBox="0 0 24 24"
      >
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}

function ProductListSkeleton() {
  return (
    <div aria-label="Carregando produtos" className="animate-pulse" role="status">
      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <div className="h-11 max-w-md rounded-lg bg-stone-200/80" />
      </div>
      <div className="divide-y divide-stone-200">
        {[0, 1, 2, 3, 4].map((item) => (
          <div className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(220px,2fr)_1fr_0.8fr_0.8fr]" key={item}>
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-stone-200" />
              <div className="h-3 w-20 rounded bg-stone-200/80" />
            </div>
            <div className="h-7 w-28 rounded-full bg-stone-200/80" />
            <div className="h-4 w-20 rounded bg-stone-200/80" />
            <div className="h-7 w-24 rounded bg-stone-200/80" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductList() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [requestKey, setRequestKey] = useState(0);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [restrictionMessage, setRestrictionMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const isAdmin = user?.role === "admin";

  function showRestriction() {
    setActionError(null);
    setSuccessMessage(null);
    setRestrictionMessage(ADMIN_ONLY_NOTICE);
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void Promise.all([
      listProducts(controller.signal),
      listCategories(controller.signal),
    ])
      .then(([loadedProducts, loadedCategories]) => {
        if (!active) return;
        setProducts(loadedProducts);
        setCategories(loadedCategories);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setErrorMessage(describeError(error));
        setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestKey]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const normalizedSearch = normalizeSearch(search);
  const visibleProducts = useMemo(() => {
    const categoryNameOf = (product: Product) =>
      categoriesById.get(product.category_id) ?? "";

    const filtered = products.filter((product) => {
      if (categoryFilter && product.category_id !== categoryFilter) return false;
      if (lowStockOnly && product.quantity > product.low_stock_threshold) return false;
      if (!normalizedSearch) return true;

      return normalizeSearch(
        `${product.name} ${product.sku} ${categoryNameOf(product)}`,
      ).includes(normalizedSearch);
    });

    // Desempata sempre pelo nome para a ordem não variar entre renders quando
    // preço, saldo ou categoria empatam.
    return filtered.sort((left, right) => {
      const comparison = compareProducts(left, right, sortKey, categoryNameOf);
      const direction = sortDirection === "asc" ? 1 : -1;

      return comparison !== 0
        ? comparison * direction
        : left.name.localeCompare(right.name, "pt-BR");
    });
  }, [
    categoriesById,
    categoryFilter,
    lowStockOnly,
    normalizedSearch,
    products,
    sortDirection,
    sortKey,
  ]);
  const lowStockCount = products.filter(
    (product) => product.quantity <= product.low_stock_threshold,
  ).length;

  const hasActiveFilters = Boolean(search || categoryFilter || lowStockOnly);

  function reloadProducts() {
    setIsLoading(true);
    setErrorMessage(null);
    setRequestKey((current) => current + 1);
  }

  function clearFilters() {
    setCategoryFilter("");
    setLowStockOnly(false);
    setSearch("");
  }

  /** Primeiro clique ordena crescente; clicar de novo na mesma coluna inverte. */
  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortDirection("asc");
    setSortKey(key);
  }

  function handleProductCreated(product: Product) {
    setProducts((current) => [product, ...current]);
    clearFilters();
    setShowCreateForm(false);
    setSuccessMessage(`${product.name} foi cadastrado no estoque.`);
  }

  function handleProductUpdated(product: Product) {
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? product : item)),
    );
    setEditingProduct(null);
    setSuccessMessage(`${product.name} foi atualizado.`);
  }

  async function handleDeleteProduct() {
    if (!productToDelete) return;

    setActionError(null);
    setDeletingProductId(productToDelete.id);

    try {
      await deleteProduct(productToDelete.id);
      setProducts((current) =>
        current.filter((product) => product.id !== productToDelete.id),
      );
      setSuccessMessage(`${productToDelete.name} foi excluído do estoque.`);
      setProductToDelete(null);
    } catch (error: unknown) {
      setActionError(
        describeMutationError(
          error,
          "Não foi possível excluir o produto. Verifique a conexão e tente novamente.",
        ),
      );
    } finally {
      setDeletingProductId(null);
    }
  }

  return (
    <>
      {!isLoading && !errorMessage ? <InventorySummary products={products} /> : null}

      <section className="mt-6 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]">
      <div className="flex flex-col gap-4 border-b border-dashed border-stone-300 bg-stone-100/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-stone-500">
            Romaneio atual · PRD-{String(products.length).padStart(3, "0")}
          </p>
          <p className="mt-1 text-sm text-stone-600" aria-live="polite">
            {isLoading
              ? "Conferindo o estoque da sessão..."
              : `${products.length} ${products.length === 1 ? "item" : "itens"} · ${lowStockCount} abaixo do mínimo`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <AdminAction
            ariaExpanded={showCreateForm}
            blockedClassName="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-400 bg-stone-100 px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500 transition hover:border-stone-500 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#17201d] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_2px_0_#0f8a5f] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            isAdmin={isAdmin}
            onBlocked={showRestriction}
            onClick={() => {
              setRestrictionMessage(null);
              setSuccessMessage(null);
              setActionError(null);
              setEditingProduct(null);
              setShowCreateForm((current) => !current);
            }}
          >
            {isAdmin && showCreateForm ? "Fechar ficha" : "+ Novo produto"}
          </AdminAction>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-600 shadow-sm transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50"
            disabled={isLoading}
            onClick={reloadProducts}
            type="button"
          >
            <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M6.1 9a7 7 0 0 1 11.5-2L20 9M4 15l2.4 2A7 7 0 0 0 18 15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {showCreateForm && isAdmin ? (
        <ProductForm
          categories={categories}
          onCancel={() => setShowCreateForm(false)}
          onSaved={handleProductCreated}
        />
      ) : null}

      {editingProduct && isAdmin ? (
        <ProductForm
          categories={categories}
          key={editingProduct.id}
          onCancel={() => setEditingProduct(null)}
          onSaved={handleProductUpdated}
          product={editingProduct}
        />
      ) : null}

      {productToDelete && isAdmin ? (
        <div className="flex flex-col gap-4 border-b border-rose-200 bg-rose-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-rose-700">
              Baixa definitiva · {productToDelete.sku}
            </p>
            <p className="mt-1 text-sm font-semibold text-rose-950">
              Excluir {productToDelete.name} e todo o histórico de movimentações vinculado?
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              className="h-9 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-wait disabled:opacity-60"
              disabled={deletingProductId === productToDelete.id}
              onClick={() => void handleDeleteProduct()}
              type="button"
            >
              {deletingProductId === productToDelete.id ? "Excluindo..." : "Excluir produto"}
            </button>
            <button
              className="h-9 px-3 text-sm font-semibold text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
              disabled={deletingProductId === productToDelete.id}
              onClick={() => setProductToDelete(null)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {restrictionMessage ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-5 py-3 sm:px-6"
          role="status"
        >
          <p className="text-sm leading-6 text-amber-900">{restrictionMessage}</p>
          <button
            className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-900 underline decoration-amber-900/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
            onClick={() => setRestrictionMessage(null)}
            type="button"
          >
            Entendi
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800 sm:px-6" role="alert">
          {actionError}
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-900 sm:px-6"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      {isLoading ? <ProductListSkeleton /> : null}

      {!isLoading && errorMessage ? (
        <div className="grid min-h-72 place-items-center px-6 py-12 text-center" role="alert">
          <div className="max-w-md">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-rose-100 font-display text-2xl font-bold text-rose-700">!</span>
            <h2 className="mt-5 font-display text-2xl font-bold text-[#17201d]">Catálogo indisponível</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{errorMessage}</p>
            <button
              className="mt-5 rounded-lg bg-[#17201d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_#0f8a5f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
              onClick={reloadProducts}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage ? (
        <>
          <div className="space-y-4 border-b border-stone-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative block w-full lg:max-w-md">
                <span className="sr-only">Buscar no catálogo</span>
                <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  className="h-11 w-full rounded-lg border border-stone-300 bg-white pl-11 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por produto, SKU ou categoria"
                  type="search"
                  value={search}
                />
              </label>

              <label className="w-full lg:w-56">
                <span className="sr-only">Filtrar por categoria</span>
                <select
                  className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  value={categoryFilter}
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                aria-pressed={lowStockOnly}
                className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 font-mono text-[10px] font-semibold uppercase tracking-wider transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                  lowStockOnly
                    ? "border-amber-700/30 bg-amber-100 text-amber-900"
                    : "border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900"
                }`}
                onClick={() => setLowStockOnly((current) => !current)}
                type="button"
              >
                <span className={`size-2 rounded-full ${lowStockOnly ? "bg-amber-600" : "bg-stone-300"}`} />
                Abaixo do mínimo
              </button>

              {/* No mobile o cabeçalho da tabela fica oculto, então a ordenação
                  precisa de um controle próprio. */}
              <label className="w-full md:hidden">
                <span className="sr-only">Ordenar por</span>
                <select
                  className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  onChange={(event) => {
                    const [key, direction] = event.target.value.split(":");
                    setSortKey(key as SortKey);
                    setSortDirection(direction as SortDirection);
                  }}
                  value={`${sortKey}:${sortDirection}`}
                >
                  {SORT_ORDER.flatMap((key) => [
                    <option key={`${key}:asc`} value={`${key}:asc`}>
                      {SORT_LABELS[key]} — crescente
                    </option>,
                    <option key={`${key}:desc`} value={`${key}:desc`}>
                      {SORT_LABELS[key]} — decrescente
                    </option>,
                  ])}
                </select>
              </label>
            </div>

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-stone-600">
                  Mostrando {visibleProducts.length} de {products.length}{" "}
                  {products.length === 1 ? "item" : "itens"}.
                </p>
                <button
                  className="text-xs font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  onClick={clearFilters}
                  type="button"
                >
                  Limpar filtros
                </button>
              </div>
            ) : null}
          </div>

          {products.length === 0 ? (
            <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
              <div className="max-w-sm">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">Estoque vazio</p>
                <h2 className="mt-3 font-display text-3xl font-bold text-[#17201d]">Cadastre o primeiro produto</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">Os itens adicionados nesta sessão aparecerão aqui com preço, categoria e saldo.</p>
              </div>
            </div>
          ) : null}

          {products.length > 0 && visibleProducts.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
              <div>
                <p className="font-display text-2xl font-bold text-[#17201d]">Nenhum item encontrado</p>
                <p className="mt-2 text-sm text-stone-600">
                  {lowStockOnly
                    ? "Nenhum item desta seleção está abaixo do estoque mínimo."
                    : "Revise a busca ou escolha outra categoria."}
                </p>
                <button className="mt-4 text-sm font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" onClick={clearFilters} type="button">
                  Limpar filtros
                </button>
              </div>
            </div>
          ) : null}

          {visibleProducts.length > 0 ? (
            <div>
              <div className="hidden grid-cols-[minmax(220px,2fr)_1fr_0.8fr_0.8fr_132px] gap-5 border-b border-stone-200 bg-stone-50 px-6 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500 md:grid">
                <SortHeader
                  activeKey={sortKey}
                  direction={sortDirection}
                  label="Produto / SKU"
                  onToggle={toggleSort}
                  sortKey="name"
                />
                <SortHeader
                  activeKey={sortKey}
                  direction={sortDirection}
                  label="Categoria"
                  onToggle={toggleSort}
                  sortKey="category"
                />
                <SortHeader
                  activeKey={sortKey}
                  direction={sortDirection}
                  label="Preço"
                  onToggle={toggleSort}
                  sortKey="price"
                />
                <SortHeader
                  activeKey={sortKey}
                  direction={sortDirection}
                  label="Saldo"
                  onToggle={toggleSort}
                  sortKey="quantity"
                />
                <span>Ações</span>
              </div>
              <ul className="divide-y divide-stone-200">
                {visibleProducts.map((product) => {
                  const isLowStock = product.quantity <= product.low_stock_threshold;
                  const categoryName = categoriesById.get(product.category_id) ?? "Sem categoria";

                  return (
                    <li className="grid gap-5 px-5 py-5 transition hover:bg-stone-50/80 sm:px-6 md:grid-cols-[minmax(220px,2fr)_1fr_0.8fr_0.8fr_132px] md:items-center" key={product.id}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-stone-300 bg-stone-100 font-display text-lg font-bold uppercase text-stone-600">
                          {product.name.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-stone-900">{product.name}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-stone-500">SKU {product.sku}</p>
                        </div>
                      </div>
                      <div>
                        <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-stone-400 md:hidden">Categoria</span>
                        <span className="inline-flex rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600">{categoryName}</span>
                      </div>
                      <div>
                        <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-stone-400 md:hidden">Preço</span>
                        <span className="font-mono text-xs font-semibold text-stone-700">{currencyFormatter.format(Number(product.price))}</span>
                      </div>
                      <div>
                        <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-stone-400 md:hidden">Saldo</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-2xl font-bold leading-none text-stone-900">{product.quantity}</span>
                          {isLowStock ? (
                            <span className="rounded bg-amber-100 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-800">Baixo</span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-800">Regular</span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-stone-400">mín. {product.low_stock_threshold}</p>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end">
                        <AdminAction
                          blockedClassName="inline-flex items-center gap-1 text-xs font-semibold text-stone-400 transition hover:text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600"
                          className="text-xs font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          isAdmin={isAdmin}
                          onBlocked={showRestriction}
                          onClick={() => {
                            setRestrictionMessage(null);
                            setActionError(null);
                            setProductToDelete(null);
                            setShowCreateForm(false);
                            setEditingProduct(product);
                          }}
                        >
                          Editar
                        </AdminAction>
                        <AdminAction
                          blockedClassName="inline-flex items-center gap-1 text-xs font-semibold text-stone-400 transition hover:text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600"
                          className="text-xs font-semibold text-rose-700 underline decoration-rose-700/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                          isAdmin={isAdmin}
                          onBlocked={showRestriction}
                          onClick={() => {
                            setRestrictionMessage(null);
                            setActionError(null);
                            setEditingProduct(null);
                            setShowCreateForm(false);
                            setProductToDelete(product);
                          }}
                        >
                          Excluir
                        </AdminAction>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
      </section>
    </>
  );
}
