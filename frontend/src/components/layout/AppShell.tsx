"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AdminPanel } from "@/components/admin/AdminPanel";
import { CategoryPanel } from "@/components/categories/CategoryPanel";
import { MovementList } from "@/components/movements/MovementList";
import { ProductList } from "@/components/products/ProductList";
import { useAuth } from "@/context/AuthProvider";
import { useSession } from "@/context/SessionProvider";

type AppSection = "products" | "categories" | "movements" | "admin";
type IconName =
  | "archive"
  | "boxes"
  | "chevron"
  | "close"
  | "folder"
  | "logout"
  | "menu"
  | "movement"
  | "shield";

interface NavItem {
  description: string;
  eyebrow: string;
  icon: IconName;
  id: AppSection;
  intro: string;
  label: string;
}

interface NavGroup {
  adminOnly?: boolean;
  items: NavItem[];
  title: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        description: "Itens, preços e saldo",
        eyebrow: "Dia 14 · Visão do estoque",
        icon: "boxes",
        id: "products",
        intro: "Consulte saldos e mantenha os itens desta demonstração organizados.",
        label: "Produtos",
      },
      {
        description: "Organização do catálogo",
        eyebrow: "Dia 12 · Catálogo",
        icon: "folder",
        id: "categories",
        intro: "Agrupe os produtos por finalidade para encontrar o estoque mais rápido.",
        label: "Categorias",
      },
    ],
    title: "Catálogo",
  },
  {
    items: [
      {
        description: "Entradas, saídas e ajustes",
        eyebrow: "Dia 13 · Operação",
        icon: "movement",
        id: "movements",
        intro: "Acompanhe cada alteração de saldo registrada nesta sessão.",
        label: "Movimentações",
      },
    ],
    title: "Operação",
  },
  {
    adminOnly: true,
    items: [
      {
        description: "Sandbox, perfis e reset",
        eyebrow: "Acesso restrito · administrador",
        icon: "shield",
        id: "admin",
        intro:
          "Inspecione a sandbox desta visita, confira o que cada perfil pode fazer e reinicie a demonstração.",
        label: "Administração",
      },
    ],
    title: "Administração",
  },
];

const SECTIONS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

function groupTitleOf(sectionId: AppSection): string {
  return NAV_GROUPS.find((group) => group.items.some((item) => item.id === sectionId))!
    .title;
}

function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    archive: (
      <>
        <path d="M4 7.5h16M6 7.5v11h12v-11M9.5 11.5h5" />
        <path d="M3.5 4h17v3.5h-17z" />
      </>
    ),
    boxes: (
      <>
        <path d="m12 3 4.5 2.5L12 8 7.5 5.5 12 3Z" />
        <path d="m7.5 5.5-4 2.25L8 10.3 12 8M16.5 5.5l4 2.25L16 10.3 12 8" />
        <path d="M8 10.3v5.2l4 2.25 4-2.25v-5.2M12 17.75V22" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    folder: (
      <path d="M3.5 6.5h6l2 2h9v10h-17v-12Z" />
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    movement: (
      <>
        <path d="M5 8h13M14 4l4 4-4 4M19 16H6M10 12l-4 4 4 4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.2 19 6v5.5c0 4-2.9 7.4-7 9.3-4.1-1.9-7-5.3-7-9.3V6l7-2.8Z" />
        <path d="m9.2 12.1 2 2 3.6-3.8" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

function formatExpiration(expiresAt: string | null): string {
  if (!expiresAt) return "expiração automática";

  return `ativa até ${new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(expiresAt))}`;
}

export function AppShell() {
  const { logout, user } = useAuth();
  const { expiresAt } = useSession();
  const [selectedSection, setSelectedSection] = useState<AppSection>("products");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const activeSection: AppSection =
    selectedSection === "admin" && !isAdmin ? "products" : selectedSection;
  const active = SECTIONS.find((section) => section.id === activeSection)!;
  const roleLabel = isAdmin ? "Administrador" : "Operador";

  const sidebar = (
    <div className="flex h-full flex-col bg-[#17201d] text-stone-100">
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] bg-emerald-400 text-[#17201d] shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]">
            <Icon className="size-6" name="archive" />
          </span>
          <div>
            <p className="font-display text-2xl font-bold leading-none tracking-tight">Estoca</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-400">
              inventário sandbox
            </p>
          </div>
        </div>
        <button
          aria-label="Fechar menu"
          className="grid size-10 place-items-center rounded-lg text-stone-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        >
          <Icon name="close" />
        </button>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 px-3 py-6">
        {NAV_GROUPS.filter((group) => isAdmin || !group.adminOnly).map((group, groupIndex) => (
          <div className={groupIndex === 0 ? "" : "mt-8"} key={group.title}>
            <p className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              {group.title}
            </p>
            <div className="mt-3 space-y-1">
              {group.items.map((section) => {
                const selected = activeSection === section.id;

                return (
                  <button
                    aria-current={selected ? "page" : undefined}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                      selected
                        ? "bg-[#f4f1e8] text-[#17201d]"
                        : "text-stone-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                    key={section.id}
                    onClick={() => {
                      setSelectedSection(section.id);
                      setMobileMenuOpen(false);
                    }}
                    type="button"
                  >
                    <Icon
                      className={`size-5 shrink-0 ${selected ? "text-emerald-700" : "text-stone-500 group-hover:text-stone-300"}`}
                      name={section.icon}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{section.label}</span>
                      <span className={`block truncate text-xs ${selected ? "text-stone-500" : "text-stone-500"}`}>
                        {section.description}
                      </span>
                    </span>
                    {selected ? <Icon className="size-4 text-stone-400" name="chevron" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl bg-black/15 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-400/15 font-display text-lg font-bold text-emerald-300">
              {user.full_name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="truncate text-xs text-stone-500">{roleLabel}</p>
            </div>
            <button
              aria-label="Trocar usuário"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-stone-500 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
              onClick={logout}
              title="Trocar usuário"
              type="button"
            >
              <Icon className="size-[18px]" name="logout" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f1e8] text-[#1d2723] md:grid md:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="hidden h-screen md:sticky md:top-0 md:block">{sidebar}</aside>

      {mobileMenuOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-[#17201d]/55 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      ) : null}
      {mobileMenuOpen ? (
        <aside
          aria-label="Menu móvel"
          className="fixed inset-y-0 left-0 z-50 w-[min(86vw,310px)] shadow-2xl md:hidden"
          id="mobile-navigation"
        >
          {sidebar}
        </aside>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-stone-300/80 bg-[#f4f1e8]/90 px-4 backdrop-blur sm:px-6 md:h-20 lg:px-10">
          <button
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menu"
            className="mr-3 grid size-10 place-items-center rounded-lg border border-stone-300 bg-white text-stone-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            <Icon name="menu" />
          </button>

          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">
              Estoque / {groupTitleOf(activeSection)}
            </p>
            <p className="truncate text-sm font-semibold text-stone-800">{active.label}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-700/[0.07] px-3 py-2 sm:flex">
              <span className="size-2 rounded-full bg-emerald-600 shadow-[0_0_0_4px_rgba(5,150,105,0.12)]" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                Sandbox {formatExpiration(expiresAt)}
              </span>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[#17201d] font-display font-bold text-white sm:hidden">
              {user.full_name.charAt(0)}
            </span>
          </div>
        </header>

        <main className="px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-5 border-b border-stone-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  {active.eyebrow}
                </p>
                <h1 className="mt-2 font-display text-4xl font-bold leading-none tracking-[-0.02em] text-[#17201d] sm:text-5xl">
                  {active.label}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">
                  {active.intro}
                </p>
              </div>
              {isAdmin && (activeSection === "products" || activeSection === "categories") ? (
                <span className="inline-flex h-10 items-center rounded-lg border border-emerald-700/20 bg-emerald-700/[0.06] px-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                  Edição liberada para admin
                </span>
              ) : null}
            </div>

            {activeSection === "products" ? (
              <ProductList />
            ) : activeSection === "categories" ? (
              <CategoryPanel />
            ) : activeSection === "movements" ? (
              <MovementList />
            ) : (
              <AdminPanel />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
