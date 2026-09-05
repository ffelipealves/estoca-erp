"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/context/AuthProvider";
import {
  ApiError,
  getSessionInfo,
  resetSession,
  type SessionInfo,
  type SessionResetResult,
} from "@/lib/api";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-users";

const PERMISSIONS: Array<{ admin: boolean; label: string; operador: boolean }> = [
  { admin: true, label: "Consultar produtos, categorias e histórico", operador: true },
  { admin: true, label: "Registrar entradas, saídas e ajustes", operador: true },
  { admin: true, label: "Criar, editar e excluir produtos", operador: false },
  { admin: true, label: "Criar, editar e excluir categorias", operador: false },
  { admin: true, label: "Reiniciar a sandbox desta sessão", operador: false },
];

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  year: "numeric",
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatCountdown(millis: number): string {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function Check({ allowed }: { allowed: boolean }) {
  return (
    <span
      className={`grid size-6 place-items-center rounded-full ${
        allowed ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-500"
      }`}
      title={allowed ? "Permitido" : "Bloqueado"}
    >
      <span className="sr-only">{allowed ? "Permitido" : "Bloqueado"}</span>
      <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" viewBox="0 0 24 24">
        {allowed ? <path d="m5 12.5 4.5 4.5L19 7" /> : <path d="M7 7l10 10M17 7 7 17" />}
      </svg>
    </span>
  );
}

function AdminPanelSkeleton() {
  return (
    <div aria-label="Carregando administração" className="mt-8 animate-pulse space-y-6" role="status">
      <div className="h-52 rounded-2xl border border-stone-300 bg-stone-200/50" />
      <div className="h-64 rounded-2xl border border-stone-300 bg-stone-200/50" />
    </div>
  );
}

export function AdminPanel() {
  const { user } = useAuth();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [requestKey, setRequestKey] = useState(0);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<SessionResetResult | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void getSessionInfo(controller.signal)
      .then((info) => {
        if (!active) return;
        setSessionInfo(info);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setErrorMessage(
          describeError(error, "Não foi possível carregar os dados da sessão."),
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestKey]);

  useEffect(() => {
    if (!sessionInfo) return;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionInfo]);

  useEffect(() => {
    if (!copied) return;

    const timeoutId = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const reload = useCallback(() => {
    setErrorMessage(null);
    setIsLoading(true);
    setRequestKey((current) => current + 1);
  }, []);

  async function handleCopySessionId() {
    if (!sessionInfo) return;

    try {
      await navigator.clipboard.writeText(sessionInfo.session_id);
      setCopied(true);
    } catch {
      setResetError("O navegador bloqueou a cópia. Selecione o identificador manualmente.");
    }
  }

  async function handleReset() {
    setResetError(null);
    setIsResetting(true);

    try {
      const result = await resetSession();
      setResetResult(result);
      setConfirmingReset(false);
      setRequestKey((current) => current + 1);
    } catch (error: unknown) {
      setResetError(
        describeError(error, "Não foi possível reiniciar a sandbox. Tente novamente."),
      );
    } finally {
      setIsResetting(false);
    }
  }

  if (user?.role !== "admin") return null;

  if (isLoading) return <AdminPanelSkeleton />;

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
            Administração indisponível
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

  if (!sessionInfo) return null;

  const remaining = new Date(sessionInfo.expires_at).getTime() - now;

  return (
    <div className="mt-8 space-y-6">
      <section
        aria-labelledby="admin-session-title"
        className="overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]"
      >
        <div className="flex flex-col gap-4 border-b border-dashed border-stone-300 bg-stone-100/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-stone-500">
              Sandbox isolada · sessão atual
            </p>
            <h2
              className="mt-1 font-display text-2xl font-bold tracking-tight text-[#17201d]"
              id="admin-session-title"
            >
              Identidade da sessão
            </h2>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-600 shadow-sm transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50"
            disabled={isLoading}
            onClick={reload}
            type="button"
          >
            Atualizar
          </button>
        </div>

        <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Identificador da sandbox
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="break-all rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 font-mono text-xs text-stone-700">
              {sessionInfo.session_id}
            </code>
            <button
              className="inline-flex h-8 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-600 shadow-sm transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              onClick={() => void handleCopySessionId()}
              type="button"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-stone-500">
            Todo produto, categoria e movimentação desta demonstração carrega esse
            identificador. Outra aba anônima recebe outra sandbox e não enxerga
            nenhum destes dados.
          </p>
        </div>

        <dl className="grid sm:grid-cols-3">
          <div className="border-b border-stone-200 px-5 py-6 sm:border-b-0 sm:border-r sm:px-6">
            <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Expira em
            </dt>
            <dd className="mt-3 font-display text-3xl font-bold tracking-tight text-[#17201d] tabular-nums">
              {formatCountdown(remaining)}
            </dd>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              {formatDateTime(sessionInfo.expires_at)}
            </p>
          </div>
          <div className="border-b border-stone-200 px-5 py-6 sm:border-b-0 sm:border-r sm:px-6">
            <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Criada em
            </dt>
            <dd className="mt-3 font-mono text-sm font-semibold text-stone-800">
              {formatDateTime(sessionInfo.created_at)}
            </dd>
            <p className="mt-2 text-xs leading-5 text-stone-500">Início desta visita</p>
          </div>
          <div className="px-5 py-6 sm:px-6">
            <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Última atividade
            </dt>
            <dd className="mt-3 font-mono text-sm font-semibold text-stone-800">
              {formatDateTime(sessionInfo.last_activity_at)}
            </dd>
            <p className="mt-2 text-xs leading-5 text-stone-500">
              Cada requisição renova a contagem
            </p>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="admin-users-title"
        className="overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]"
      >
        <div className="border-b border-dashed border-stone-300 bg-stone-100/70 px-5 py-4 sm:px-6">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-stone-500">
            Controle de acesso · 2 perfis
          </p>
          <h2
            className="mt-1 font-display text-2xl font-bold tracking-tight text-[#17201d]"
            id="admin-users-title"
          >
            Usuários da demonstração
          </h2>
        </div>

        <ul className="divide-y divide-stone-200">
          {DEMO_USERS.map((demoUser) => {
            const isCurrent = demoUser.email === user.email;

            return (
              <li className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6" key={demoUser.email}>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#17201d] font-display text-lg font-bold text-emerald-300">
                  {demoUser.label.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-stone-900">{demoUser.label}</p>
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-800">
                        Você
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-stone-500">{demoUser.email}</p>
                </div>
                <code className="rounded border border-stone-300 bg-stone-100 px-2 py-1 font-mono text-[11px] text-stone-600">
                  {DEMO_PASSWORD}
                </code>
              </li>
            );
          })}
        </ul>

        <div className="overflow-x-auto border-t border-stone-200">
          <table className="w-full min-w-[420px] text-left">
            <caption className="sr-only">
              Permissões por perfil, aplicadas pelo backend em cada requisição
            </caption>
            <thead>
              <tr className="bg-stone-50 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                <th className="px-5 py-3 font-semibold sm:px-6" scope="col">
                  Ação
                </th>
                <th className="w-24 px-3 py-3 text-center font-semibold" scope="col">
                  Admin
                </th>
                <th className="w-24 px-3 py-3 text-center font-semibold" scope="col">
                  Operador
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {PERMISSIONS.map((permission) => (
                <tr key={permission.label}>
                  <td className="px-5 py-3 text-sm text-stone-700 sm:px-6">{permission.label}</td>
                  <td className="px-3 py-3">
                    <span className="flex justify-center">
                      <Check allowed={permission.admin} />
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex justify-center">
                      <Check allowed={permission.operador} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="border-t border-stone-200 px-5 py-4 text-xs leading-5 text-stone-500 sm:px-6">
          As restrições são aplicadas pelo backend a cada requisição: um token de
          operador recebe 403 nas rotas de mutação, mesmo que a interface seja
          contornada.
        </p>
      </section>

      <section
        aria-labelledby="admin-reset-title"
        className="overflow-hidden rounded-2xl border border-amber-900/20 bg-[#f5dfaa] shadow-[0_16px_45px_rgba(46,52,48,0.06)]"
      >
        <div className="border-b border-amber-900/15 px-5 py-4 sm:px-6">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-amber-900/65">
            Zona de manutenção · somente administrador
          </p>
          <h2
            className="mt-1 font-display text-2xl font-bold tracking-tight text-[#352b18]"
            id="admin-reset-title"
          >
            Reiniciar a sandbox
          </h2>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p className="max-w-2xl text-sm leading-6 text-amber-950/80">
            Apaga as movimentações, os produtos e as categorias desta sessão e
            recria o catálogo inicial. Seu acesso é preservado: os usuários da
            demonstração e o identificador da sandbox continuam os mesmos, sem
            precisar entrar de novo.
          </p>

          {resetResult ? (
            <p
              className="mt-4 rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
              role="status"
            >
              Sandbox reiniciada: {resetResult.categories_seeded} categorias e{" "}
              {resetResult.products_seeded} produtos recriados. Abra Produtos ou
              Movimentações para ver o catálogo inicial de volta.
            </p>
          ) : null}

          {resetError ? (
            <p
              className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              role="alert"
            >
              {resetError}
            </p>
          ) : null}

          {confirmingReset ? (
            <div className="mt-5 rounded-xl border border-amber-900/25 bg-[#fff8e7] p-4">
              <p className="text-sm font-semibold text-[#352b18]">
                Reiniciar agora? O histórico de movimentações desta sessão será
                perdido.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-lg bg-amber-900 px-4 text-sm font-bold text-[#fff8e7] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900 disabled:cursor-wait disabled:opacity-60"
                  disabled={isResetting}
                  onClick={() => void handleReset()}
                  type="button"
                >
                  {isResetting ? "Reiniciando..." : "Confirmar reinício"}
                </button>
                <button
                  className="h-9 px-3 text-sm font-semibold text-amber-900/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
                  disabled={isResetting}
                  onClick={() => setConfirmingReset(false)}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-amber-900/30 bg-[#fff8e7] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-950 shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
              onClick={() => {
                setResetError(null);
                setResetResult(null);
                setConfirmingReset(true);
              }}
              type="button"
            >
              Reiniciar sandbox
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
