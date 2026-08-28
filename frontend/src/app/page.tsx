export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-3xl rounded-3xl border border-emerald-400/20 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-950/30 sm:p-12">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-400 font-black text-slate-950">
            E
          </span>
          <span className="text-xl font-semibold tracking-tight">Estoca</span>
        </div>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-400">
          Mini ERP de estoque
        </p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          O frontend começou a ganhar forma.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
          A API já está publicada. O próximo incremento conecta esta interface à
          sessão isolada da demonstração e implementa o fluxo de login.
        </p>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-emerald-300">
            Next.js 16
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2 text-slate-300">
            TypeScript
          </span>
          <span className="rounded-full border border-slate-700 px-4 py-2 text-slate-300">
            App Router
          </span>
        </div>
      </section>
    </main>
  );
}
