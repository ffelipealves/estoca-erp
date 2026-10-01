"use client"

import * as React from "react"
import Link from "next/link"
import { PencilSimpleIcon, PlusIcon, TagSimpleIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react"
import { useActions, useEstoca } from "@/lib/estoca/store"
import { getValueByCategory } from "@/lib/estoca/selectors"
import { isLowStock } from "@/lib/estoca/rules"
import { formatBRL, formatInt, pluralize } from "@/lib/estoca/format"
import type { Category } from "@/lib/estoca/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "../page-header"
import { EmptyState, ErrorState } from "../data-state"
import { PermissionButton, useCan } from "../locked-button"
import { CategoryDialog, DeleteCategoryDialog } from "./category-dialogs"

export function CategoriasView() {
  const data = useEstoca()
  const { refreshCatalog } = useActions()
  // Counts, units and value per category all derive from the catalog in memory.
  const status = data.catalogStatus === "ready" ? "ready" : data.catalogStatus === "error" ? "error" : "loading"
  const canManage = useCan("gerir-categorias")
  const rows = getValueByCategory(data).toSorted((a, b) => a.category.name.localeCompare(b.category.name, "pt-BR"))
  const [editor, setEditor] = React.useState<{ open: boolean; category: Category | null; key: number }>({
    open: false,
    category: null,
    key: 0,
  })
  const [toDelete, setToDelete] = React.useState<Category | null>(null)
  const openCreate = () => setEditor((e) => ({ open: true, category: null, key: e.key + 1 }))

  return (
    <>
      <PageHeader
        title="Categorias"
        description={`${pluralize(data.categories.length, "categoria organiza", "categorias organizam")} o catálogo. Só categorias vazias podem ser excluídas.`}
        actions={
          <PermissionButton
            permission="gerir-categorias"
            onClick={openCreate}
            icon={<PlusIcon weight="bold" />}
            label="Nova categoria"
            variant="default"
          />
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        {status === "loading" ? (
          <div aria-busy="true" aria-label="Carregando categorias">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-6 border-b px-5 py-5 last:border-b-0">
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        ) : status === "error" ? (
          <ErrorState
            title="Não foi possível carregar as categorias"
            detail="A API não respondeu. Tente de novo em alguns segundos."
            onRetry={refreshCatalog}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={TagSimpleIcon}
            title="Nenhuma categoria ainda"
            action={
              canManage ? (
                <Button onClick={openCreate}>
                  <PlusIcon weight="bold" />
                  Criar categoria
                </Button>
              ) : null
            }
          >
            {canManage
              ? "Crie uma categoria antes de cadastrar produtos: todo produto pertence a uma."
              : "Só o Administrador cria categorias. Troque de perfil no topo da tela para testar."}
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const low = data.products.filter((p) => p.categoryId === row.category.id && isLowStock(p)).length
              return (
                <li
                  key={row.category.id}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.6fr))_auto] md:items-center md:gap-6"
                >
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold">{row.category.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {row.category.description || "Sem descrição."}
                    </p>
                  </div>
                  <dl className="contents">
                    <Stat label="Produtos">
                      {row.count > 0 ? (
                        <Link
                          href={`/produtos?categoria=${row.category.id}`}
                          className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
                        >
                          {formatInt(row.count)}
                        </Link>
                      ) : (
                        "0"
                      )}
                      {low > 0 ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-bold text-warn">
                          <WarningIcon className="size-3.5" weight="bold" />
                          {low} baixo{low > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </Stat>
                    <Stat label="Unidades">{formatInt(row.units)}</Stat>
                    <Stat label="Valor armazenado">{formatBRL(row.value)}</Stat>
                  </dl>
                  <div className="flex items-center gap-1.5 md:justify-end">
                    <PermissionButton
                      permission="gerir-categorias"
                      onClick={() => setEditor((e) => ({ open: true, category: row.category, key: e.key + 1 }))}
                      icon={<PencilSimpleIcon weight="bold" />}
                      label="Editar"
                      size="sm"
                    />
                    <PermissionButton
                      permission="gerir-categorias"
                      onClick={() => setToDelete(row.category)}
                      icon={<TrashIcon weight="bold" />}
                      label="Excluir"
                      size="sm"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <CategoryDialog
        key={editor.key}
        open={editor.open}
        category={editor.category}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
      />
      <DeleteCategoryDialog category={toDelete} onOpenChange={(open) => !open && setToDelete(null)} />
    </>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 md:block">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums md:mt-0.5 md:text-[17px]">{children}</dd>
    </div>
  )
}
