"use client"

import * as React from "react"
import { ArrowsDownUpIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import { listStockMovements, type StockMovementFilters, type StockMovementPage } from "@/lib/api"
import { toMovement } from "@/lib/estoca/adapters"
import { useEstoca, useFlashId } from "@/lib/estoca/store"
import { useApiQuery } from "@/lib/estoca/use-api-query"
import { indexById } from "@/lib/estoca/selectors"
import { MOVEMENT_META } from "@/lib/estoca/rules"
import { formatDateTime, formatInt, pluralize } from "@/lib/estoca/format"
import type { Movement, MovementType } from "@/lib/estoca/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "../page-header"
import { EmptyState, ErrorState, FilteredEmpty } from "../data-state"
import { useOverlays } from "../overlays"
import { OpGlyph, OpLabel } from "../op-glyph"
import { useUrlState } from "../use-url-state"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10
const ALL = "todos"
const TYPES: (MovementType | typeof ALL)[] = [ALL, "entrada", "saida", "ajuste"]
type Period = "7" | "30" | "tudo" | "personalizado"
const PERIOD_LABEL: Record<Period, string> = {
  "7": "Últimos 7 dias",
  "30": "Últimos 30 dias",
  tudo: "Todo o período",
  personalizado: "Personalizado",
}
const DAY = 86_400_000
const EMPTY_PAGE: StockMovementPage = { items: [], page: 1, page_size: PAGE_SIZE, total: 0, pages: 0 }

/** Only the overall count: tells "no history yet" from "nothing matches". */
const loadOverall = (signal: AbortSignal) => listStockMovements(1, 1, {}, signal)

export function MovimentacoesView() {
  const { products, movementsVersion } = useEstoca()
  const flashId = useFlashId()
  const { openMovement } = useOverlays()
  const [params, setParams] = useUrlState()

  const produto = params.get("produto") ?? ALL
  const tipo = (params.get("tipo") as MovementType | null) ?? ALL
  const periodo = (params.get("periodo") as Period | null) ?? "tudo"
  const de = params.get("de") ?? ""
  const ate = params.get("ate") ?? ""
  const pagina = Math.max(1, Number(params.get("pagina")) || 1)

  const productsById = React.useMemo(() => indexById(products), [products])
  const sortedProducts = React.useMemo(
    () => products.toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products],
  )
  const [now] = React.useState(() => Date.now())
  const invalidRange = periodo === "personalizado" && !!de && !!ate && de > ate

  // The API filters and paginates. Days are civil days in the visitor's own
  // time zone, so the instants are built here, where that zone is known.
  const loadPage = React.useCallback(
    (signal: AbortSignal) => {
      if (invalidRange) return Promise.resolve(EMPTY_PAGE)
      const filters: StockMovementFilters = {}
      if (produto !== ALL) filters.productId = produto
      if (tipo !== ALL) filters.type = tipo
      if (periodo === "7") filters.dateFrom = new Date(now - 7 * DAY).toISOString()
      else if (periodo === "30") filters.dateFrom = new Date(now - 30 * DAY).toISOString()
      else if (periodo === "personalizado") {
        if (de) filters.dateFrom = new Date(`${de}T00:00:00`).toISOString()
        if (ate) filters.dateTo = new Date(`${ate}T23:59:59.999`).toISOString()
      }
      return listStockMovements(pagina, PAGE_SIZE, filters, signal)
    },
    [invalidRange, produto, tipo, periodo, de, ate, now, pagina],
  )
  const history = useApiQuery(loadPage, "Não foi possível ler o histórico.", movementsVersion)
  const overall = useApiQuery(loadOverall, "Não foi possível ler o histórico.", movementsVersion)
  const status =
    history.status === "error" || overall.status === "error"
      ? "error"
      : history.data && overall.data
        ? "ready"
        : "loading"
  const retry = () => {
    if (history.status === "error") history.retry()
    if (overall.status === "error") overall.retry()
  }

  const totalAll = overall.data?.total ?? 0
  const total = history.data?.total ?? 0
  const pages = Math.max(1, history.data?.pages ?? 1)
  const page = Math.min(pagina, pages)
  const pageRows = React.useMemo(() => (history.data?.items ?? []).map(toMovement), [history.data])
  const filtersActive = produto !== ALL || tipo !== ALL || periodo !== "tudo"

  // A page past the end (a link from before a filter or a deletion) falls back to the last one.
  const lastPage = history.data && history.data.pages > 0 ? history.data.pages : null
  React.useEffect(() => {
    if (lastPage !== null && pagina > lastPage) setParams({ pagina: lastPage === 1 ? null : String(lastPage) })
  }, [lastPage, pagina, setParams])

  const setFilter = (patch: Record<string, string | null>) => setParams({ ...patch, pagina: null })
  const clearFilters = () => setFilter({ produto: null, tipo: null, periodo: null, de: null, ate: null })

  return (
    <>
      <PageHeader
        title="Movimentações"
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <OpGlyph type="entrada" size="sm" /> Entrada soma
            </span>
            <span className="inline-flex items-center gap-1.5">
              <OpGlyph type="saida" size="sm" /> Saída retira
            </span>
            <span className="inline-flex items-center gap-1.5">
              <OpGlyph type="ajuste" size="sm" /> Ajuste define o saldo final após contagem
            </span>
          </span>
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
        <div className="grid gap-1.5">
          <span id="f-prod" className="text-[13px] font-semibold text-muted-foreground">
            Produto
          </span>
          <Select value={produto} onValueChange={(v) => setFilter({ produto: v === ALL ? null : v })}>
            <SelectTrigger aria-labelledby="f-prod" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={ALL}>Todos os produtos</SelectItem>
              {sortedProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="truncate">{p.name}</span>
                  <span className="sku ml-auto pl-3 text-[13px] text-muted-foreground">{p.sku}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[13px] font-semibold text-muted-foreground">Tipo</legend>
          <div className="flex h-10 overflow-hidden rounded-md border border-input bg-card shadow-[inset_0_-2px_0_rgb(27_31_34/0.06)]">
            {TYPES.map((t) => {
              const selected = t === tipo
              return (
                <label
                  key={t}
                  className={cn(
                    "flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-r border-input px-2.5 text-sm font-semibold sm:px-3 last:border-r-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring",
                    selected ? "bg-rail text-rail-foreground" : "hover:bg-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name="f-tipo"
                    className="sr-only"
                    checked={selected}
                    onChange={() => setFilter({ tipo: t === ALL ? null : t })}
                  />
                  {t === ALL ? "Todas" : (
                    <>
                      <OpGlyph type={t} size="sm" className="size-4 text-[11px]" />
                      <span>{MOVEMENT_META[t].label}</span>
                    </>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <span id="f-per" className="text-[13px] font-semibold text-muted-foreground">
              Período
            </span>
            <Select
              value={periodo}
              onValueChange={(v) => setFilter({ periodo: v === "tudo" ? null : v, ...(v !== "personalizado" ? { de: null, ate: null } : {}) })}
            >
              <SelectTrigger aria-labelledby="f-per" className="min-w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {periodo === "personalizado" ? (
            <>
              <div className="grid gap-1.5">
                <label htmlFor="f-de" className="text-[13px] font-semibold text-muted-foreground">
                  De
                </label>
                <Input id="f-de" type="date" value={de} onChange={(e) => setFilter({ de: e.target.value })} className="w-40" aria-invalid={invalidRange} />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="f-ate" className="text-[13px] font-semibold text-muted-foreground">
                  Até
                </label>
                <Input id="f-ate" type="date" value={ate} onChange={(e) => setFilter({ ate: e.target.value })} className="w-40" aria-invalid={invalidRange} />
              </div>
            </>
          ) : null}
        </div>
      </div>
      {invalidRange ? (
        <p role="alert" className="-mt-2 mb-3 text-[13px] font-medium text-[#773226]">
          A data inicial é depois da final. Ajuste o período.
        </p>
      ) : null}

      {status === "ready" && totalAll > 0 ? (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground" aria-live="polite">
          {filtersActive
            ? `${pluralize(total, "movimentação encontrada", "movimentações encontradas")} de ${formatInt(totalAll)}`
            : pluralize(total, "movimentação", "movimentações")}
          {filtersActive ? (
            <Button variant="link" className="text-sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : null}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        {status === "loading" ? (
          <HistorySkeleton />
        ) : status === "error" ? (
          <ErrorState
            title="Não foi possível carregar o histórico"
            detail="A API não respondeu ao buscar as movimentações. Os saldos não foram alterados."
            onRetry={retry}
          />
        ) : totalAll === 0 ? (
          <EmptyState
            icon={ArrowsDownUpIcon}
            title="Nenhuma movimentação registrada"
            action={
              <Button variant="outline" onClick={() => openMovement()}>
                Registrar a primeira
              </Button>
            }
          >
            Cada entrada, saída ou ajuste aparece aqui com o saldo que resultou dele.
          </EmptyState>
        ) : total === 0 ? (
          <FilteredEmpty onClear={clearFilters} what="movimentação" />
        ) : (
          <>
            <HistoryTable rows={pageRows} productsById={productsById} flashId={flashId} />
            <HistoryList rows={pageRows} productsById={productsById} flashId={flashId} />
            <Pagination
              page={page}
              pages={pages}
              total={total}
              onPage={(p) => setParams({ pagina: p === 1 ? null : String(p) })}
            />
          </>
        )}
      </div>
    </>
  )
}

type RowsProps = {
  rows: Movement[]
  productsById: Map<string, { name: string; sku: string }>
  flashId: string | null
}

function Quantity({ m }: { m: Movement }) {
  if (m.type === "ajuste") {
    const diff = m.resultingBalance - m.previousBalance
    return (
      <>
        <span className="font-bold tabular-nums">={formatInt(m.quantity)}</span>
        <span className="block text-[12px] text-muted-foreground tabular-nums">
          era {formatInt(m.previousBalance)} ({diff >= 0 ? "+" : "−"}
          {formatInt(Math.abs(diff))})
        </span>
      </>
    )
  }
  return (
    <span className="font-bold tabular-nums">
      {m.type === "entrada" ? "+" : "−"}
      {formatInt(m.quantity)}
    </span>
  )
}

function HistoryTable({ rows, productsById, flashId }: RowsProps) {
  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead className="border-b bg-well text-[13px] text-muted-foreground">
        <tr>
          <th scope="col" className="py-2.5 pr-3 pl-5 font-semibold">Operação</th>
          <th scope="col" className="px-3 font-semibold">Data</th>
          <th scope="col" className="px-3 font-semibold">Produto</th>
          <th scope="col" className="px-3 font-semibold">Observação</th>
          <th scope="col" className="px-3 text-right font-semibold">Quantidade</th>
          <th scope="col" className="pr-5 pl-3 text-right font-semibold">Saldo resultante</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((m) => {
          const product = productsById.get(m.productId)
          return (
            <tr key={m.id} className={cn(m.id === flashId && "good-read")}>
              <td className="py-3 pr-3 pl-5">
                <OpLabel type={m.type} />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                {formatDateTime(m.createdAt)}
              </td>
              <td className="max-w-[300px] px-3 py-3">
                <p className="truncate font-semibold">{product?.name ?? "Produto excluído"}</p>
                <p className="sku text-[13px] text-muted-foreground">{product?.sku}</p>
              </td>
              <td className="max-w-[260px] px-3 py-3 text-muted-foreground">
                {m.note ? <span className="line-clamp-2">{m.note}</span> : <span className="text-[#8a9296]">Sem observação</span>}
              </td>
              <td className="px-3 py-3 text-right">
                <Quantity m={m} />
              </td>
              <td className="py-3 pr-5 pl-3 text-right">
                <span className="readout text-[22px]">{formatInt(m.resultingBalance)}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function HistoryList({ rows, productsById, flashId }: RowsProps) {
  return (
    <ul className="divide-y md:hidden">
      {rows.map((m) => {
        const product = productsById.get(m.productId)
        return (
          <li key={m.id} className={cn("px-4 py-3.5", m.id === flashId && "good-read")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <OpLabel type={m.type} className="text-sm" />
                <p className="mt-1.5 font-semibold leading-snug">{product?.name ?? "Produto excluído"}</p>
                <p className="text-[13px] text-muted-foreground">
                  <span className="sku">{product?.sku}</span>, {formatDateTime(m.createdAt)}
                </p>
                {m.note ? <p className="mt-1 text-[13px] text-muted-foreground">{m.note}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <Quantity m={m} />
                <p className="mt-1 text-[12px] text-muted-foreground">
                  saldo <span className="readout text-lg text-foreground">{formatInt(m.resultingBalance)}</span>
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number
  pages: number
  total: number
  onPage(p: number): void
}) {
  const first = (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t bg-well px-5 py-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {first} a {last} de {formatInt(total)}
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 1}>
          <CaretLeftIcon weight="bold" />
          Anterior
        </Button>
        <ol className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, pages).map((p, i) =>
            p === null ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
                …
              </li>
            ) : (
              <li key={p}>
                <Button
                  variant={p === page ? "default" : "ghost"}
                  size="icon-sm"
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Página ${p}`}
                  onClick={() => onPage(p)}
                  className="tabular-nums"
                >
                  {p}
                </Button>
              </li>
            ),
          )}
        </ol>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page === pages}>
          Próxima
          <CaretRightIcon weight="bold" />
        </Button>
      </div>
    </nav>
  )
}

/** First, last and the neighbours of the current page; gaps in between. */
function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))
  const out: (number | null)[] = []
  let previous = 0
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - previous > 1) out.push(null)
    out.push(p)
    previous = p
  }
  return out
}

function HistorySkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando histórico">
      <div className="h-10 border-b bg-well" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b px-5 py-4 last:border-b-0">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="hidden h-4 w-28 md:block" />
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  )
}
