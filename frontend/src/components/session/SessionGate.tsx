"use client";

import { useSession } from "@/context/SessionProvider";

export function SessionGate({ children }: React.PropsWithChildren) {
  const { errorMessage, retry, status } = useSession();

  if (status === "bootstrapping") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-md text-center" role="status" aria-live="polite">
          <span className="mx-auto block size-12 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-400" />
          <h1 className="mt-6 text-2xl font-semibold">
            Preparando sua demonstração
          </h1>
          <p className="mt-3 leading-7 text-slate-400">
            Estamos criando um ambiente de estoque isolado para você. No plano
            gratuito, a API pode levar cerca de um minuto para acordar.
          </p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="max-w-md rounded-2xl border border-rose-400/20 bg-slate-900 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-300">
            Falha ao iniciar
          </p>
          <h1 className="mt-3 text-2xl font-semibold">
            Não conseguimos preparar a sessão
          </h1>
          <p className="mt-3 leading-7 text-slate-400">{errorMessage}</p>
          <button
            className="mt-6 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
            onClick={retry}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  return children;
}
