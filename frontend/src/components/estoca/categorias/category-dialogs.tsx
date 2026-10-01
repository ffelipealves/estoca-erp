"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { toast } from "sonner"
import { CircleNotchIcon, LinkBreakIcon, TrashIcon } from "@phosphor-icons/react"
import { useActions, useEstoca } from "@/lib/estoca/store"
import { pluralize } from "@/lib/estoca/format"
import type { Category } from "@/lib/estoca/types"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "../produtos/product-dialog"

export function CategoryDialog({
  open,
  category,
  onOpenChange,
}: {
  open: boolean
  category: Category | null
  onOpenChange(open: boolean): void
}) {
  const editing = !!category
  const { createCategory, updateCategory } = useActions()
  const [name, setName] = React.useState(category?.name ?? "")
  const [description, setDescription] = React.useState(category?.description ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const inFlight = React.useRef(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    if (!name.trim()) {
      setError("Informe o nome da categoria.")
      document.getElementById("cat-name")?.focus()
      return
    }
    inFlight.current = true
    setPending(true)
    const draft = { name, description }
    const result = editing ? await updateCategory(category.id, draft) : await createCategory(draft)
    inFlight.current = false
    if (!result.ok) {
      // Render first: the fields are disabled while sending and cannot take focus.
      flushSync(() => {
        setPending(false)
        setError(result.message)
      })
      document.getElementById("cat-name")?.focus()
      return
    }
    setPending(false)
    toast.success(editing ? "Categoria atualizada" : "Categoria criada", { description: name.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent busy={pending} className="sm:max-w-[480px]">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Categorias agrupam produtos no catálogo e no painel.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <fieldset disabled={pending} className="grid gap-5">
              <Field id="cat-name" label="Nome" error={error ?? undefined}>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  aria-invalid={!!error}
                  placeholder="Ex.: Pintura"
                  maxLength={40}
                />
              </Field>
              <div className="grid gap-2">
                <label htmlFor="cat-desc" className="text-sm leading-none font-semibold">
                  Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Textarea
                  id="cat-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="O que entra nesta categoria"
                  maxLength={120}
                />
              </div>
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : null}
              {pending ? "Salvando…" : editing ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteCategoryDialog({
  category,
  onOpenChange,
}: {
  category: Category | null
  onOpenChange(open: boolean): void
}) {
  const { products } = useEstoca()
  const { deleteCategory } = useActions()
  const [pending, setPending] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [snapshot, setSnapshot] = React.useState<Category | null>(category)
  const inFlight = React.useRef(false)

  if (category && category !== snapshot) {
    setSnapshot(category)
    setServerError(null)
  }
  const shown = category ?? snapshot
  const linked = shown ? products.filter((p) => p.categoryId === shown.id) : []
  const blocked = linked.length > 0

  async function onConfirm() {
    if (!shown || inFlight.current) return
    inFlight.current = true
    setPending(true)
    const result = await deleteCategory(shown.id)
    inFlight.current = false
    setPending(false)
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    toast.success("Categoria excluída", { description: shown.name })
    onOpenChange(false)
  }

  return (
    <Dialog open={!!category} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent busy={pending} role="alertdialog" className="sm:max-w-[520px]">
        {blocked ? (
          <>
            <DialogHeader>
              <span className="mb-1 inline-flex size-9 items-center justify-center rounded-md bg-danger-soft text-[#773226]">
                <LinkBreakIcon className="size-4.5" weight="bold" />
              </span>
              <DialogTitle>{shown?.name} ainda tem produtos</DialogTitle>
              <DialogDescription>
                Uma categoria só pode ser excluída quando está vazia. Hoje, {pluralize(linked.length, "produto usa", "produtos usam")} esta categoria.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-5 text-[15px]">
              <ul className="divide-y overflow-hidden rounded-lg border">
                {linked.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="sku shrink-0 text-[13px] text-muted-foreground">{p.sku}</span>
                  </li>
                ))}
                {linked.length > 5 ? (
                  <li className="px-3.5 py-2.5 text-sm text-muted-foreground">e mais {linked.length - 5}</li>
                ) : null}
              </ul>
              <div>
                <p className="font-bold">Como liberar a exclusão</p>
                <ol className="mt-2 grid list-decimal gap-1.5 pl-5 leading-relaxed">
                  <li>Abra cada produto e troque a categoria em Editar, ou exclua o produto.</li>
                  <li>Com a categoria vazia, volte aqui e exclua.</li>
                </ol>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button asChild>
                <Link href={`/produtos?categoria=${shown?.id}`} onClick={() => onOpenChange(false)}>
                  Ver produtos da categoria
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Excluir {shown?.name}?</DialogTitle>
              <DialogDescription>A categoria está vazia. Nenhum produto ou movimentação é afetado.</DialogDescription>
            </DialogHeader>
            {serverError ? (
              <DialogBody>
                <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-[#7d2616]">
                  {serverError} Mova ou exclua os produtos e tente de novo.
                </p>
              </DialogBody>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={onConfirm} disabled={pending}>
                {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : <TrashIcon weight="bold" />}
                {pending ? "Excluindo…" : "Excluir categoria"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
