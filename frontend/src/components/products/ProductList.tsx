"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  listCategories,
  listProducts,
  type Category,
  type Product,
} from "@/lib/api";

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [requestKey, setRequestKey] = useState(0);
  const [search, setSearch] = useState("");

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
    if (!normalizedSearch) return products;

    return products.filter((product) => {
      const categoryName = categoriesById.get(product.category_id) ?? "";
      return normalizeSearch(`${product.name} ${product.sku} ${categoryName}`).includes(
        normalizedSearch,
      );
    });
  }, [categoriesById, normalizedSearch, products]);
  const lowStockCount = products.filter(
    (product) => product.quantity <= product.low_stock_threshold,
  ).length;

  function reloadProducts() {
    setIsLoading(true);
    setErrorMessage(null);
    setRequestKey((current) => current + 1);
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]">
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
        <button
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-stone-300 bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-600 shadow-sm transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50 sm:self-auto"
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
          <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
            <label className="relative block max-w-lg">
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
                <p className="mt-2 text-sm text-stone-600">Revise a busca ou use outro nome, SKU ou categoria.</p>
                <button className="mt-4 text-sm font-semibold text-emerald-800 underline decoration-emerald-800/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" onClick={() => setSearch("")} type="button">
                  Limpar busca
                </button>
              </div>
            </div>
          ) : null}

          {visibleProducts.length > 0 ? (
            <div>
              <div className="hidden grid-cols-[minmax(220px,2fr)_1fr_0.8fr_0.8fr] gap-5 border-b border-stone-200 bg-stone-50 px-6 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500 md:grid">
                <span>Produto / SKU</span>
                <span>Categoria</span>
                <span>Preço</span>
                <span>Saldo</span>
              </div>
              <ul className="divide-y divide-stone-200">
                {visibleProducts.map((product) => {
                  const isLowStock = product.quantity <= product.low_stock_threshold;
                  const categoryName = categoriesById.get(product.category_id) ?? "Sem categoria";

                  return (
                    <li className="grid gap-5 px-5 py-5 transition hover:bg-stone-50/80 sm:px-6 md:grid-cols-[minmax(220px,2fr)_1fr_0.8fr_0.8fr] md:items-center" key={product.id}>
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
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
