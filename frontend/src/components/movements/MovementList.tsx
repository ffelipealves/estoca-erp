"use client";

import { useEffect, useMemo, useState } from "react";

import { MovementForm } from "@/components/movements/MovementForm";
import {
  ApiError,
  listProducts,
  listStockMovements,
  type Product,
  type StockMovement,
  type StockMovementPage,
  type StockMovementType,
} from "@/lib/api";

const PAGE_SIZE = 20;

const movementLabels: Record<StockMovementType, string> = {
  ajuste: "Ajuste",
  entrada: "Entrada",
  saida: "Saída",
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível carregar as movimentações. Verifique a conexão e tente novamente.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function movementValue(movement: StockMovement): string {
  if (movement.type === "entrada") return `+${movement.quantity}`;
  if (movement.type === "saida") return `−${movement.quantity}`;
  return `→ ${movement.resulting_quantity}`;
}

function movementTone(type: StockMovementType): string {
  if (type === "entrada") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (type === "saida") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function MovementList() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [movementPage, setMovementPage] = useState<StockMovementPage | null>(null);
  const [page, setPage] = useState(1);
  const [productId, setProductId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [requestKey, setRequestKey] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void Promise.all([
      listStockMovements(page, PAGE_SIZE, productId || undefined, controller.signal),
      listProducts(controller.signal),
    ])
      .then(([loadedMovements, loadedProducts]) => {
        if (!active) return;
        setMovementPage(loadedMovements);
        setProducts(loadedProducts);
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
  }, [page, productId, requestKey]);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  function reloadMovements() {
    setErrorMessage(null);
    setIsLoading(true);
    setRequestKey((current) => current + 1);
  }

  function handleMovementCreated(movement: StockMovement) {
    setPage(1);
    setProductId("");
    setShowCreateForm(false);
    setSuccessMessage(
      `${movementLabels[movement.type]} registrada. Saldo final: ${movement.resulting_quantity}.`,
    );
    setIsLoading(true);
    setRequestKey((current) => current + 1);
  }

  const total = movementPage?.total ?? 0;
  const pages = movementPage?.pages ?? 0;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]">
      <div className="flex flex-col gap-4 border-b border-dashed border-stone-300 bg-stone-100/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-stone-500">
            Livro de estoque · MOV-{String(total).padStart(3, "0")}
          </p>
          <p className="mt-1 text-sm text-stone-600" aria-live="polite">
            {isLoading
              ? "Conferindo o histórico da sessão..."
              : `${total} ${total === 1 ? "registro" : "registros"} no histórico`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            aria-expanded={showCreateForm}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#17201d] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_2px_0_#0f8a5f] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-50"
            disabled={isLoading}
            onClick={() => {
              setSuccessMessage(null);
              setShowCreateForm((current) => !current);
            }}
            type="button"
          >
            {showCreateForm ? "Fechar ordem" : "+ Nova movimentação"}
          </button>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-600 shadow-sm transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50"
            disabled={isLoading}
            onClick={reloadMovements}
            type="button"
          >
            Atualizar
          </button>
        </div>
      </div>

      {showCreateForm ? (
        <MovementForm
          onCancel={() => setShowCreateForm(false)}
          onCreated={handleMovementCreated}
          products={products}
        />
      ) : null}

      {successMessage ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-900 sm:px-6" role="status">
          {successMessage}
        </div>
      ) : null}

      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <label className="block max-w-sm">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Filtrar por produto
          </span>
          <select
            className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-800 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
            onChange={(event) => {
              setPage(1);
              setProductId(event.target.value);
              setIsLoading(true);
              setErrorMessage(null);
            }}
            value={productId}
          >
            <option value="">Todos os produtos</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.sku}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="divide-y divide-stone-200" aria-label="Carregando movimentações" role="status">
          {[0, 1, 2, 3].map((item) => (
            <div className="grid animate-pulse gap-4 px-5 py-5 sm:px-6 md:grid-cols-[120px_minmax(220px,1fr)_100px_110px]" key={item}>
              <div className="h-7 rounded-full bg-stone-200" />
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-stone-200" />
                <div className="h-3 w-28 rounded bg-stone-200/80" />
              </div>
              <div className="h-7 rounded bg-stone-200" />
              <div className="h-4 rounded bg-stone-200/80" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && errorMessage ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center" role="alert">
          <div className="max-w-md">
            <h2 className="font-display text-2xl font-bold text-[#17201d]">Histórico indisponível</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{errorMessage}</p>
            <button
              className="mt-5 rounded-lg bg-[#17201d] px-4 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
              onClick={reloadMovements}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && total === 0 ? (
        <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
          <div className="max-w-sm">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
              Livro sem lançamentos
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-[#17201d]">
              Nenhuma movimentação registrada
            </h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Entradas, saídas e ajustes desta sessão aparecerão aqui em ordem cronológica reversa.
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && movementPage && total > 0 ? (
        <>
          <div className="hidden grid-cols-[120px_minmax(220px,1fr)_100px_110px] gap-5 border-b border-stone-200 bg-stone-50 px-6 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500 md:grid">
            <span>Operação</span>
            <span>Produto / observação</span>
            <span>Quantidade</span>
            <span>Saldo final</span>
          </div>
          <ol className="divide-y divide-stone-200">
            {movementPage.items.map((movement) => {
              const product = productsById.get(movement.product_id);

              return (
                <li className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[120px_minmax(220px,1fr)_100px_110px] md:items-center" key={movement.id}>
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider ${movementTone(movement.type)}`}>
                      {movementLabels[movement.type]}
                    </span>
                    <p className="mt-2 text-[11px] leading-4 text-stone-400">
                      {formatDate(movement.created_at)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">
                      {product?.name ?? "Produto removido"}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                      {product ? `SKU ${product.sku}` : "Registro histórico"}
                    </p>
                    {movement.note ? (
                      <p className="mt-2 text-xs leading-5 text-stone-500">{movement.note}</p>
                    ) : null}
                  </div>
                  <div>
                    <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-stone-400 md:hidden">
                      Quantidade
                    </span>
                    <span className="font-display text-2xl font-bold text-stone-900">
                      {movementValue(movement)}
                    </span>
                  </div>
                  <div>
                    <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-stone-400 md:hidden">
                      Saldo final
                    </span>
                    <span className="font-mono text-sm font-semibold text-stone-700">
                      {movement.resulting_quantity} un.
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {pages > 1 ? (
            <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-4 sm:px-6">
              <button
                className="text-sm font-semibold text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page <= 1 || isLoading}
                onClick={() => {
                  setIsLoading(true);
                  setPage((current) => current - 1);
                }}
                type="button"
              >
                ← Anterior
              </button>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                Página {page} de {pages}
              </span>
              <button
                className="text-sm font-semibold text-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={page >= pages || isLoading}
                onClick={() => {
                  setIsLoading(true);
                  setPage((current) => current + 1);
                }}
                type="button"
              >
                Próxima →
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
