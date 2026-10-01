"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircleIcon,
  PackageIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import { getBalanceTimeline, listStockMovements, type StockBalancePoint } from "@/lib/api"
import { toMovement } from "@/lib/estoca/adapters"
import { useActions, useEstoca, useFlashId } from "@/lib/estoca/store"
import {
  getLowStock,
  getTotals,
  getValueByCategory,
  indexById,
  toTimeline,
} from "@/lib/estoca/selectors"
import {
  formatBRL,
  formatDateTime,
  formatInt,
  formatPercent,
  formatRelative,
  pluralize,
} from "@/lib/estoca/format"
import { MOVEMENT_META } from "@/lib/estoca/rules"
import type { Category, Movement, MovementType, Product } from "@/lib/estoca/types"
import { useApiQuery } from "@/lib/estoca/use-api-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader, Panel } from "../page-header"
import { EmptyState, ErrorState } from "../data-state"
import { useOverlays } from "../overlays"
import { OpGlyph, signedQuantity } from "../op-glyph"
import { OpShape } from "./op-shape"
import { UrgencyTag } from "../urgency-tag"
import { cn } from "@/lib/utils"

const BalanceTimeline = dynamic(() => import("./balance-timeline"), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px] w-full sm:h-[260px]" />,
})

const LOW_STOCK_VISIBLE = 3
const RECENT_COUNT = 6

const loadRecent = (signal: AbortSignal) => listStockMovements(1, RECENT_COUNT, {}, signal)

export function PainelView() {
  const { products, categories, catalogStatus, movementsVersion } = useEstoca()
  const { refreshCatalog } = useActions()
  // Totals come from the catalog; the timeline and the latest movements are
  // read again whenever a movement lands.
  const timeline = useApiQuery(getBalanceTimeline, "Não foi possível ler a linha do tempo.", movementsVersion)
  const recent = useApiQuery(loadRecent, "Não foi possível ler as últimas movimentações.", movementsVersion)

  const failed = catalogStatus === "error" || timeline.status === "error" || recent.status === "error"
  const ready = catalogStatus === "ready" && timeline.data !== null && recent.data !== null

  function retry() {
    if (catalogStatus === "error") refreshCatalog()
    if (timeline.status === "error") timeline.retry()
    if (recent.status === "error") recent.retry()
  }

  return (
    <>
      <PageHeader
        title="Painel"
        description="Leitura da sua sandbox agora. Totais calculados a partir dos produtos; a linha do tempo, a partir das movimentações."
      />
      {failed ? (
        <div className="rounded-lg border bg-card">
          <ErrorState
            title="Não foi possível carregar o painel"
            detail="A API não respondeu ao buscar produtos e movimentações. Seus dados continuam salvos na sandbox."
            onRetry={retry}
          />
        </div>
      ) : !ready ? (
        <PainelSkeleton />
      ) : (
        <PainelContent
          products={products}
          categories={categories}
          points={timeline.data!.points}
          recent={recent.data!.items.map(toMovement)}
        />
      )}
    </>
  )
}

function PainelContent({
  products,
  categories,
  points,
  recent,
}: {
  products: Product[]
  categories: Category[]
  points: StockBalancePoint[]
  recent: Movement[]
}) {
  const totals = getTotals({ products, categories })
  const lowStock = getLowStock(products)
  const byCategory = getValueByCategory({ products, categories })
  const productsById = React.useMemo(() => indexById(products), [products])
  const [now] = React.useState(() => Date.now())
  const timeline = React.useMemo(() => toTimeline(points, now), [points, now])
  const flashId = useFlashId()

  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-8 lg:gap-5">
        <Visor totals={totals} />
        <Panel
          id="saldo"
          title="Saldo total em unidades"
          meta={
            points.length
              ? `Muda só quando há movimentação. ${pluralize(points.length, "movimentação", "movimentações")} desde ${formatDateTime(points[0].at).slice(0, 5)}.`
              : "Muda só quando há movimentação."
          }
          action={<TimelineLegend />}
          className="lg:flex-1"
          bodyClassName="flex flex-col px-2 pb-3 sm:px-3"
        >
          {points.length === 0 ? (
            <EmptyState icon={PackageIcon} title="Sem histórico ainda" className="py-8">
              Cadastre um produto ou registre uma movimentação para a linha do tempo começar.
            </EmptyState>
          ) : (
            <>
              <BalanceTimeline points={timeline} productsById={productsById} />
              <TimelineTable points={timeline} productsById={productsById} />
            </>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4 self-start lg:col-span-4 lg:gap-5">
        <LowStockQueue items={lowStock} />
        <Panel
          id="categorias"
          title="Valor por categoria"
          meta="Preço unitário × saldo, somado por categoria."
          bodyClassName="px-5 pb-5"
        >
          {byCategory.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma categoria na sandbox.</p>
          ) : (
            <ul className="grid gap-4">
              {byCategory.map((row) => (
                <li key={row.category.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm">
                      <span className="font-semibold">{row.category.name}</span>
                      <span className="ml-1.5 text-[12px] text-muted-foreground tabular-nums">
                        {formatInt(row.units)} un.
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatBRL(row.value)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-[3px] bg-well" aria-hidden>
                      <div
                        className="h-full rounded-r-[3px] bg-rail transition-[width] duration-300"
                        style={{ width: `${Math.max(row.share * 100, row.value > 0 ? 1.5 : 0)}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                      {formatPercent(row.share)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        id="recentes"
        title="Últimas movimentações"
        action={
          <Button asChild variant="ghost" size="sm" className="-mr-2">
            <Link href="/movimentacoes">
              Ver histórico
              <ArrowRightIcon weight="bold" />
            </Link>
          </Button>
        }
        className="lg:col-span-12"
      >
        {recent.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="grid grid-cols-1 border-t lg:grid-cols-2 lg:[&>li:nth-child(odd)]:border-r">
            {recent.map((m) => {
              const product = productsById.get(m.productId)
              return (
                <li key={m.id} className={cn("flex min-w-0 items-center gap-3 border-b px-4 py-2.5 sm:px-5", m.id === flashId && "good-read")}>
                  <OpGlyph type={m.type} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product?.name ?? "Produto excluído"}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {formatRelative(m.createdAt)}
                      {m.note ? `, ${m.note}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">{signedQuantity(m.type, m.quantity, m.previousBalance)}</p>
                    <p className="text-[12px] text-muted-foreground tabular-nums">saldo {formatInt(m.resultingBalance)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Visor({ totals, className }: { totals: ReturnType<typeof getTotals>; className?: string }) {
  return (
    <section
      aria-label="Totais da sandbox"
      className={cn(
        "on-rail grid overflow-hidden rounded-lg bg-rail text-rail-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)] sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <p className="text-[13px] text-rail-muted">Valor armazenado</p>
        <p
          className="mt-2 text-[44px] leading-none font-extrabold tracking-[-0.02em] sm:text-[56px]"
          style={{ fontStretch: "72%", fontVariantNumeric: "proportional-nums" }}
        >
          {formatBRL(totals.value)}
        </p>
        <p className="mt-3 text-[13px] text-rail-muted">
          Soma de preço unitário × saldo dos {pluralize(totals.productCount, "produto", "produtos")}.
        </p>
      </div>
      <dl className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-1 sm:border-t-0 sm:border-l">
        <div className="border-r border-white/10 px-5 py-4 sm:border-r-0 sm:border-b sm:px-6">
          <dt className="text-[13px] text-rail-muted">Unidades em estoque</dt>
          <dd className="readout mt-1.5 text-[32px]" style={{ fontVariantNumeric: "proportional-nums" }}>
            {formatInt(totals.units)}
          </dd>
        </div>
        <div className="px-5 py-4 sm:px-6">
          <dt className="text-[13px] text-rail-muted">Categorias ativas</dt>
          <dd className="mt-1.5 flex items-baseline gap-1.5">
            <span className="readout text-[32px]">{totals.activeCategories}</span>
            <span className="text-sm text-rail-muted">de {totals.totalCategories}</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}

function LowStockQueue({
  items,
  className,
}: {
  items: ReturnType<typeof getLowStock>
  className?: string
}) {
  const { openMovement } = useOverlays()
  return (
    <Panel
      id="baixo"
      title="Estoque baixo"
      meta={
        items.length
          ? `${pluralize(items.length, "produto", "produtos")} no limite mínimo ou abaixo.${items.length > LOW_STOCK_VISIBLE ? ` Os ${LOW_STOCK_VISIBLE} mais urgentes primeiro.` : ""}`
          : "Quando um saldo chega ao limite mínimo do produto, ele aparece aqui."
      }
      className={className}
    >
      {items.length === 0 ? (
        <EmptyState icon={CheckCircleIcon} title="Nenhum produto no limite" className="py-6">
          Todos os saldos estão acima do mínimo definido em cada produto.
        </EmptyState>
      ) : (
        <>
          <ol className="divide-y border-t">
            {items.slice(0, LOW_STOCK_VISIBLE).map(({ product, urgency }) => (
              <li key={product.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm leading-snug font-semibold">{product.name}</p>
                  <UrgencyTag urgency={urgency} />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[13px] text-muted-foreground">
                    <span className="readout mr-1 text-xl text-foreground">{formatInt(product.balance)}</span>
                    de mín. {formatInt(product.lowStockLimit)}
                    <span className="sku ml-2">{product.sku}</span>
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2"
                    onClick={() => openMovement({ productId: product.id, type: "entrada" })}
                    aria-label={`Registrar entrada de ${product.name}`}
                  >
                    <PlusIcon weight="bold" />
                    Entrada
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t px-5 py-3">
            <Link
              href="/produtos?baixo=1"
              className="inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
            >
              {items.length > LOW_STOCK_VISIBLE ? `Ver todos os ${items.length}` : "Ver no catálogo"}
              <ArrowRightIcon weight="bold" className="size-4" />
            </Link>
          </div>
        </>
      )}
    </Panel>
  )
}

function TimelineLegend() {
  const types: MovementType[] = ["entrada", "saida", "ajuste"]
  const label: Record<MovementType, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" }
  return (
    <ul className="flex shrink-0 flex-wrap justify-end gap-x-3 gap-y-1 pt-0.5 text-[13px] text-muted-foreground" aria-label="Legenda">
      {types.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <OpShape type={t} cx={6} cy={6} r={3.5} />
          </svg>
          {label[t]}
        </li>
      ))}
    </ul>
  )
}

function TimelineTable({
  points,
  productsById,
}: {
  points: ReturnType<typeof toTimeline>
  productsById: Map<string, { name: string }>
}) {
  // Every step of the chart except the trailing "now".
  const rows = points.filter((p) => p.count > 0)
  return (
    <details className="group mx-3 mt-1 text-sm">
      <summary className="cursor-pointer rounded-sm py-1.5 font-semibold text-muted-foreground select-none hover:text-foreground">
        Ver os dados do gráfico em tabela
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-well text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Data</th>
              <th className="px-3 py-2 font-semibold">Movimentação</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p, i) => {
              const m = p.movement
              return (
                <tr key={m?.id ?? `t-${p.t}`}>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                    {formatDateTime(new Date(p.t).toISOString())}
                  </td>
                  <td className="px-3 py-1.5">
                    {m ? (
                      <>
                        {MOVEMENT_META[m.type].label} {m.delta >= 0 ? "+" : "−"}
                        {formatInt(Math.abs(m.delta))} · {productsById.get(m.productId)?.name ?? "Produto excluído"}
                      </>
                    ) : i === 0 ? (
                      `Início do histórico: estoque inicial (${pluralize(p.count, "lançamento", "lançamentos")})`
                    ) : (
                      `${pluralize(p.count, "movimentação", "movimentações")} no mesmo instante`
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatInt(p.units)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function PainelSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:gap-5" aria-busy="true" aria-label="Carregando painel">
      <div className="flex flex-col gap-4 lg:col-span-8 lg:gap-5">
        <Skeleton className="h-[188px] rounded-lg bg-[#cfd6d4]" />
        <Skeleton className="h-[420px] rounded-lg" />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-4 lg:gap-5">
        <Skeleton className="h-[330px] rounded-lg" />
        <Skeleton className="h-[230px] rounded-lg" />
      </div>
      <Skeleton className="h-[220px] rounded-lg lg:col-span-12" />
    </div>
  )
}
