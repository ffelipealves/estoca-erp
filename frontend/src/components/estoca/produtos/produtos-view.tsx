"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowsDownUpIcon,
  PackageIcon,
  PencilSimpleIcon,
  PlusIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import { useActions, useEstoca, useFlashProductId } from "@/lib/estoca/store"
import { indexById } from "@/lib/estoca/selectors"
import { isLowStock, urgencyOf } from "@/lib/estoca/rules"
import { formatBRL, formatInt, normalize, pluralize } from "@/lib/estoca/format"
import type { Product } from "@/lib/estoca/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "../page-header"
import { EmptyState, ErrorState, FilteredEmpty } from "../data-state"
import { PermissionButton, useCan } from "../locked-button"
import { useOverlays } from "../overlays"
import { UrgencyTag } from "../urgency-tag"
import { useUrlState } from "../use-url-state"
import { ProductDialog } from "./product-dialog"
import { DeleteProductDialog } from "./delete-product-dialog"
import { cn } from "@/lib/utils"

type SortKey = "nome" | "categoria" | "preco" | "saldo"
const SORT_LABEL: Record<SortKey, string> = {
  nome: "Nome ou SKU",
  categoria: "Categoria",
  preco: "Preço unitário",
  saldo: "Saldo",
}
const ALL = "todas"

export function ProdutosView() {
  const { products, categories, catalogStatus } = useEstoca()
  const { refreshCatalog } = useActions()
  // The catalog (at most 50 products) is already in memory: filters run here.
  const status = catalogStatus === "ready" ? "ready" : catalogStatus === "error" ? "error" : "loading"
  const flashProductId = useFlashProductId() ?? undefined
  const [params, setParams] = useUrlState()
  const canManage = useCan("gerir-produtos")
  const [editor, setEditor] = React.useState<{ open: boolean; product: Product | null; key: number }>({
    open: false,
    product: null,
    key: 0,
  })
  const [toDelete, setToDelete] = React.useState<Product | null>(null)

  const q = params.get("q") ?? ""
  const categoria = params.get("categoria") ?? ALL
  const baixo = params.get("baixo") === "1"
  const sort = (params.get("ordem") as SortKey) || "nome"
  const dir = params.get("dir") === "desc" ? "desc" : "asc"

  const categoriesById = React.useMemo(() => indexById(categories), [categories])
  const source = products
  const deferredQ = React.useDeferredValue(q)

  const rows = React.useMemo(() => {
    const needle = normalize(deferredQ)
    const filtered = source.filter((p) => {
      if (categoria !== ALL && p.categoryId !== categoria) return false
      if (baixo && !isLowStock(p)) return false
      if (!needle) return true
      const cat = categoriesById.get(p.categoryId)?.name ?? ""
      return normalize(`${p.name} ${p.sku} ${cat}`).includes(needle)
    })
    const factor = dir === "asc" ? 1 : -1
    return filtered.toSorted((a, b) => {
      let r = 0
      if (sort === "nome") r = a.name.localeCompare(b.name, "pt-BR")
      else if (sort === "categoria")
        r =
          (categoriesById.get(a.categoryId)?.name ?? "").localeCompare(
            categoriesById.get(b.categoryId)?.name ?? "",
            "pt-BR",
          ) || a.name.localeCompare(b.name, "pt-BR")
      else if (sort === "preco") r = a.price - b.price
      else r = a.balance - b.balance
      return r * factor
    })
  }, [source, deferredQ, categoria, baixo, sort, dir, categoriesById])

  const lowCount = source.filter(isLowStock).length
  const filtersActive = !!q || categoria !== ALL || baixo

  function clearFilters() {
    setParams({ q: null, categoria: null, baixo: null })
  }
  function setSort(key: SortKey) {
    if (key === sort) setParams({ dir: dir === "asc" ? "desc" : null })
    else setParams({ ordem: key === "nome" ? null : key, dir: null })
  }
  const openCreate = () => setEditor((e) => ({ open: true, product: null, key: e.key + 1 }))
  const openEdit = (product: Product) => setEditor((e) => ({ open: true, product, key: e.key + 1 }))

  return (
    <>
      <PageHeader
        title="Produtos"
        description={
          <>
            {pluralize(source.length, "produto", "produtos")} no catálogo. O saldo muda só por movimentações.
            {!canManage ? " Como Operador, você consulta e movimenta; a gestão do catálogo fica travada." : null}
          </>
        }
        actions={
          <PermissionButton
            permission="gerir-produtos"
            onClick={openCreate}
            icon={<PlusIcon weight="bold" />}
            label="Novo produto"
            variant="default"
          />
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="grid w-full gap-1.5 sm:w-auto">
          <span className="text-[13px] font-semibold text-muted-foreground" id="f-cat">
            Categoria
          </span>
          <Select value={categoria} onValueChange={(v) => setParams({ categoria: v === ALL ? null : v })}>
            <SelectTrigger aria-labelledby="f-cat" className="w-full sm:w-auto sm:min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          aria-pressed={baixo}
          onClick={() => setParams({ baixo: baixo ? null : "1" })}
          className={cn("h-10", baixo && "border-foreground bg-warn-soft shadow-[inset_0_0_0_1px_var(--foreground)] hover:bg-warn-soft")}
        >
          <WarningIcon weight="bold" className={baixo ? "text-warn" : "text-muted-foreground"} />
          Só estoque baixo
          <span className="rounded-sm bg-secondary px-1.5 text-[12px] tabular-nums">{lowCount}</span>
        </Button>

        <div className="grid w-full gap-1.5 sm:ml-auto sm:w-auto">
          <span className="text-[13px] font-semibold text-muted-foreground" id="f-sort">
            Ordenar por
          </span>
          <div className="flex gap-1.5">
            <Select value={sort} onValueChange={(v) => setParams({ ordem: v === "nome" ? null : v, dir: null })}>
              <SelectTrigger aria-labelledby="f-sort" className="flex-1 sm:min-w-40 sm:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="size-10"
              onClick={() => setParams({ dir: dir === "asc" ? "desc" : null })}
              aria-label={dir === "asc" ? "Ordem crescente. Inverter" : "Ordem decrescente. Inverter"}
              title={dir === "asc" ? "Crescente" : "Decrescente"}
            >
              {dir === "asc" ? <SortAscendingIcon weight="bold" /> : <SortDescendingIcon weight="bold" />}
            </Button>
          </div>
        </div>
      </div>

      {status === "ready" && source.length > 0 ? (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
          <span>
            {filtersActive
              ? `${pluralize(rows.length, "produto encontrado", "produtos encontrados")} de ${formatInt(source.length)}`
              : `${pluralize(rows.length, "produto", "produtos")}`}
            {q ? (
              <>
                {" "}
                para <strong className="font-semibold text-foreground">“{q}”</strong>
              </>
            ) : null}
          </span>
          {filtersActive ? (
            <Button variant="link" className="text-sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          ) : null}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        {status === "loading" ? (
          <ListSkeleton />
        ) : status === "error" ? (
          <ErrorState
            title="Não foi possível carregar os produtos"
            detail="A API demorou para responder. Nada foi alterado no catálogo."
            onRetry={refreshCatalog}
          />
        ) : source.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title="Nenhum produto cadastrado"
            action={
              canManage ? (
                <Button onClick={openCreate}>
                  <PlusIcon weight="bold" />
                  Cadastrar produto
                </Button>
              ) : null
            }
          >
            {canManage
              ? "Cadastre o primeiro item com SKU, preço e limite de estoque baixo. Ou resete a sandbox em Administração para voltar ao catálogo inicial."
              : "Só o Administrador cadastra produtos. Troque de perfil no topo da tela para testar."}
          </EmptyState>
        ) : rows.length === 0 ? (
          <FilteredEmpty onClear={clearFilters} what="produto" />
        ) : (
          <>
            <ProductTable
              rows={rows}
              categoriesById={categoriesById}
              sort={sort}
              dir={dir}
              onSort={setSort}
              flashProductId={flashProductId}
              onEdit={openEdit}
              onDelete={setToDelete}
            />
            <ProductList
              rows={rows}
              categoriesById={categoriesById}
              onEdit={openEdit}
              onDelete={setToDelete}
              flashProductId={flashProductId}
            />
          </>
        )}
      </div>

      <ProductDialog
        key={editor.key}
        open={editor.open}
        product={editor.product}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
      />
      <DeleteProductDialog product={toDelete} onOpenChange={(open) => !open && setToDelete(null)} />
    </>
  )
}

type RowProps = {
  rows: Product[]
  flashProductId?: string
  categoriesById: Map<string, { name: string }>
  onEdit(p: Product): void
  onDelete(p: Product): void
}

function ProductTable({
  rows,
  categoriesById,
  sort,
  dir,
  onSort,
  onEdit,
  onDelete,
  flashProductId,
}: RowProps & { sort: SortKey; dir: "asc" | "desc"; onSort(k: SortKey): void }) {
  const { openMovement } = useOverlays()
  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort === key
    return (
      <th
        scope="col"
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn("px-3 py-0 font-semibold first:pl-5", align === "right" && "text-right")}
      >
        <button
          type="button"
          onClick={() => onSort(key)}
          className={cn(
            "inline-flex h-10 items-center gap-1 rounded-sm hover:text-foreground",
            active ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {label}
          {active ? (
            dir === "asc" ? (
              <ArrowUpIcon className="size-3.5" weight="bold" />
            ) : (
              <ArrowDownIcon className="size-3.5" weight="bold" />
            )
          ) : null}
        </button>
      </th>
    )
  }

  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead className="border-b bg-well text-[13px]">
        <tr>
          {header("nome", "Produto")}
          {header("categoria", "Categoria")}
          {header("preco", "Preço unit.", "right")}
          {header("saldo", "Saldo", "right")}
          <th scope="col" className="px-3 font-semibold text-muted-foreground">
            Situação
          </th>
          <th scope="col" className="pr-5 text-right font-semibold text-muted-foreground">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((p) => {
          const low = isLowStock(p)
          return (
            <tr key={p.id} className={cn("group hover:bg-[#f3f5f4]", p.id === flashProductId && "good-read")}>
              <td className="max-w-[340px] py-3 pr-3 pl-5">
                <p className="font-semibold">{p.name}</p>
                <p className="sku mt-0.5 text-[13px] text-muted-foreground">{p.sku}</p>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{categoriesById.get(p.categoryId)?.name}</td>
              <td className="px-3 py-3 text-right tabular-nums">{formatBRL(p.price)}</td>
              <td className="px-3 py-3 text-right">
                <span className={cn("readout text-[22px]", p.balance === 0 && "text-saida")}>{formatInt(p.balance)}</span>
                <p className="text-[12px] text-muted-foreground tabular-nums">mín. {formatInt(p.lowStockLimit)}</p>
              </td>
              <td className="px-3 py-3">
                {low ? <UrgencyTag urgency={urgencyOf(p)} /> : <span className="text-[13px] text-muted-foreground">Normal</span>}
              </td>
              <td className="py-3 pr-5">
                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openMovement({ productId: p.id })}>
                    <ArrowsDownUpIcon weight="bold" />
                    Movimentar
                  </Button>
                  <PermissionButton
                    permission="gerir-produtos"
                    onClick={() => onEdit(p)}
                    icon={<PencilSimpleIcon weight="bold" />}
                    label={`Editar ${p.name}`}
                    iconOnly
                    variant="ghost"
                    size="icon-sm"
                  />
                  <PermissionButton
                    permission="gerir-produtos"
                    onClick={() => onDelete(p)}
                    icon={<TrashIcon weight="bold" />}
                    label={`Excluir ${p.name}`}
                    iconOnly
                    variant="ghost"
                    size="icon-sm"
                    className="hover:bg-danger-soft hover:text-[#773226]"
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ProductList({ rows, categoriesById, onEdit, onDelete, flashProductId }: RowProps) {
  const { openMovement } = useOverlays()
  return (
    <ul className="divide-y md:hidden">
      {rows.map((p) => {
        const low = isLowStock(p)
        return (
          <li key={p.id} className={cn("px-4 py-4", p.id === flashProductId && "good-read")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{p.name}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  <span className="sku">{p.sku}</span>, {categoriesById.get(p.categoryId)?.name}
                </p>
                <p className="mt-1 text-sm tabular-nums">{formatBRL(p.price)} / un.</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn("readout text-[28px]", p.balance === 0 && "text-saida")}>{formatInt(p.balance)}</span>
                <p className="text-[12px] text-muted-foreground tabular-nums">mín. {formatInt(p.lowStockLimit)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {low ? <UrgencyTag urgency={urgencyOf(p)} /> : null}
              <div className="ml-auto flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => openMovement({ productId: p.id })}>
                  <ArrowsDownUpIcon weight="bold" />
                  Movimentar
                </Button>
                <PermissionButton
                  permission="gerir-produtos"
                  onClick={() => onEdit(p)}
                  icon={<PencilSimpleIcon weight="bold" />}
                  label={`Editar ${p.name}`}
                  iconOnly
                  variant="outline"
                  size="icon-sm"
                />
                <PermissionButton
                  permission="gerir-produtos"
                  onClick={() => onDelete(p)}
                  icon={<TrashIcon weight="bold" />}
                  label={`Excluir ${p.name}`}
                  iconOnly
                  variant="outline"
                  size="icon-sm"
                />
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando produtos">
      <div className="h-10 border-b bg-well" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b px-5 py-4 last:border-b-0">
          <div className="flex-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
          <Skeleton className="hidden h-4 w-24 md:block" />
          <Skeleton className="hidden h-4 w-16 md:block" />
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  )
}
