"use client";

import { useEffect, useState } from "react";

import { BalanceTimelineChart } from "@/components/dashboard/BalanceTimelineChart";
import { CategoryValueChart } from "@/components/dashboard/CategoryValueChart";
import { InventorySummary } from "@/components/products/InventorySummary";
import {
  ApiError,
  getBalanceTimeline,
  listCategories,
  listProducts,
  type Category,
  type Product,
  type StockBalancePoint,
} from "@/lib/api";

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível carregar o resumo do estoque. Verifique a conexão e tente novamente.";
}

function DashboardSkeleton() {
  return (
    <div
      aria-label="Carregando resumo do estoque"
      className="mt-8 animate-pulse overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.85fr)]"
      role="status"
    >
      <div>
        <div className="border-b border-dashed border-stone-300 px-5 py-5 sm:px-6">
          <div className="h-3 w-40 rounded bg-stone-200/80" />
          <div className="mt-3 h-6 w-52 rounded bg-stone-200" />
        </div>
        <div className="grid sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div className="border-b border-stone-200 px-5 py-6 sm:border-b-0 sm:border-r sm:px-6" key={item}>
              <div className="h-3 w-24 rounded bg-stone-200/80" />
              <div className="mt-4 h-8 w-28 rounded bg-stone-200" />
              <div className="mt-3 h-3 w-32 rounded bg-stone-200/70" />
            </div>
          ))}
        </div>
      </div>
      <div className="min-h-56 border-t border-amber-900/15 bg-[#f5dfaa]/60 lg:border-l lg:border-t-0" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mt-6 animate-pulse overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8]"
    >
      <div className="border-b border-dashed border-stone-300 px-5 py-5 sm:px-6">
        <div className="h-3 w-36 rounded bg-stone-200/80" />
        <div className="mt-3 h-6 w-44 rounded bg-stone-200" />
      </div>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        {[0, 1, 2, 3].map((item) => (
          <div className="h-3 rounded bg-stone-200/70" key={item} style={{ width: `${90 - item * 18}%` }} />
        ))}
      </div>
    </div>
  );
}

export function DashboardPanel() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [timeline, setTimeline] = useState<StockBalancePoint[]>([]);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void Promise.all([
      listProducts(controller.signal),
      listCategories(controller.signal),
      getBalanceTimeline(controller.signal),
    ])
      .then(([loadedProducts, loadedCategories, loadedTimeline]) => {
        if (!active) return;
        setProducts(loadedProducts);
        setCategories(loadedCategories);
        setTimeline(loadedTimeline.points);
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

  function reload() {
    setErrorMessage(null);
    setIsLoading(true);
    setRequestKey((current) => current + 1);
  }

  if (isLoading) {
    return (
      <>
        <DashboardSkeleton />
        <ChartSkeleton />
      </>
    );
  }

  if (errorMessage) {
    return (
      <section
        className="mt-8 grid min-h-64 place-items-center rounded-2xl border border-stone-300 bg-[#fffdf8] px-6 py-12 text-center"
        role="alert"
      >
        <div className="max-w-md">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-rose-100 font-display text-2xl font-bold text-rose-700">
            !
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold text-[#17201d]">
            Resumo indisponível
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">{errorMessage}</p>
          <button
            className="mt-5 rounded-lg bg-[#17201d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_3px_0_#0f8a5f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            onClick={reload}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="mt-8 grid min-h-72 place-items-center rounded-2xl border border-stone-300 bg-[#fffdf8] px-6 py-12 text-center">
        <div className="max-w-sm">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
            Sandbox sem catálogo
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-[#17201d]">
            Nada para resumir ainda
          </h2>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Cadastre produtos em Produtos e o fechamento desta sessão aparecerá aqui.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <InventorySummary products={products} />

      {/* Menos de dois pontos não é tendência, é um número — que o card acima
          já mostra. */}
      {timeline.length >= 2 ? (
        <section
          aria-labelledby="balance-timeline-title"
          className="mt-6 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]"
        >
          <div className="border-b border-dashed border-stone-300 px-5 py-5 sm:px-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
              Histórico · unidades em estoque
            </p>
            <h2
              className="mt-1 font-display text-2xl font-bold tracking-tight text-[#17201d]"
              id="balance-timeline-title"
            >
              Evolução do saldo
            </h2>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <BalanceTimelineChart points={timeline} />
          </div>
        </section>
      ) : null}

      <CategoryValueChart categories={categories} products={products} />
    </>
  );
}
