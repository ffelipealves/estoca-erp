"use client";

import { useState, type FormEvent } from "react";

import { useAuth } from "@/context/AuthProvider";
import { ApiError } from "@/lib/api";

const DEMO_PASSWORD = "demo123";

const DEMO_USERS = [
  {
    description: "Acesso completo para cadastrar e editar o catálogo.",
    email: "admin@estoca.demo",
    label: "Administrador",
  },
  {
    description: "Acesso operacional para consultar e movimentar o estoque.",
    email: "operador@estoca.demo",
    label: "Operador",
  },
] as const;

function describeLoginError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Não foi possível entrar agora. Tente novamente.";
}

export function LoginScreen() {
  const { isRestoring, isSubmitting, login, logout, user } = useAuth();
  const [email, setEmail] = useState<string>(DEMO_USERS[0].email);
  const [password, setPassword] = useState<string>(DEMO_PASSWORD);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await login({ email, password });
    } catch (error: unknown) {
      setErrorMessage(describeLoginError(error));
    }
  }

  if (isRestoring) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <p className="text-sm text-slate-400" role="status">
          Restaurando seu acesso...
        </p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
        <section className="w-full max-w-xl rounded-3xl border border-emerald-400/20 bg-slate-900 p-8 shadow-2xl shadow-emerald-950/30 sm:p-12">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-400 text-2xl font-black text-slate-950">
            {user.full_name.charAt(0)}
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Acesso confirmado
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Olá, {user.full_name}
          </h1>
          <p className="mt-4 leading-7 text-slate-300">
            Você entrou como <strong className="text-slate-100">{user.role}</strong>.
            No próximo incremento, esta área receberá a navegação e a lista de
            categorias e produtos.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
              {user.email}
            </span>
            <button
              className="text-sm font-semibold text-slate-400 transition hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
              onClick={logout}
              type="button"
            >
              Trocar usuário
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-emerald-400 p-8 text-slate-950 sm:p-12">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-slate-950 font-black text-emerald-400">
              E
            </span>
            <span className="text-xl font-bold tracking-tight">Estoca</span>
          </div>
          <p className="mt-14 text-sm font-bold uppercase tracking-[0.22em]">
            Demonstração isolada
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Entre e experimente o estoque sem medo.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-slate-800">
            Os dados desta visita pertencem somente à sua sessão e serão limpos
            automaticamente depois que ela expirar.
          </p>
        </div>

        <div className="p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Acessar demonstração
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Escolha um perfil
          </h2>
          <p className="mt-3 leading-7 text-slate-400">
            As credenciais já estão preenchidas para facilitar a avaliação.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {DEMO_USERS.map((demoUser) => {
              const selected = email === demoUser.email;

              return (
                <button
                  aria-pressed={selected}
                  className={`rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    selected
                      ? "border-emerald-400 bg-emerald-400/10"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                  key={demoUser.email}
                  onClick={() => {
                    setEmail(demoUser.email);
                    setPassword(DEMO_PASSWORD);
                    setErrorMessage(null);
                  }}
                  type="button"
                >
                  <span className="font-semibold">{demoUser.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-400">
                    {demoUser.description}
                  </span>
                </button>
              );
            })}
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-300" htmlFor="email">
                Email
              </label>
              <input
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                disabled={isSubmitting}
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300" htmlFor="password">
                Senha
              </label>
              <input
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                disabled={isSubmitting}
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            {errorMessage ? (
              <p
                className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              className="flex w-full items-center justify-center rounded-xl bg-emerald-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Entrando..." : "Entrar na demonstração"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
