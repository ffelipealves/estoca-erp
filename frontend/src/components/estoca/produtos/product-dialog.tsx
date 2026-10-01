"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { toast } from "sonner"
import { ArrowsDownUpIcon, CircleNotchIcon, InfoIcon } from "@phosphor-icons/react"
import { useActions, useEstoca } from "@/lib/estoca/store"
import { formatInt, parseBRL } from "@/lib/estoca/format"
import type { Product } from "@/lib/estoca/types"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOverlays } from "../overlays"

type Errors = Partial<Record<"name" | "sku" | "categoryId" | "price" | "lowStockLimit" | "initialQuantity", string>>

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,19}$/

export function ProductDialog({
  open,
  product,
  onOpenChange,
}: {
  open: boolean
  product: Product | null
  onOpenChange(open: boolean): void
}) {
  const editing = !!product
  const { categories } = useEstoca()
  const { createProduct, updateProduct } = useActions()
  const { openMovement } = useOverlays()
  const [name, setName] = React.useState(product?.name ?? "")
  const [sku, setSku] = React.useState(product?.sku ?? "")
  const [categoryId, setCategoryId] = React.useState(product?.categoryId ?? "")
  const [price, setPrice] = React.useState(
    product ? product.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
  )
  const [limit, setLimit] = React.useState(product ? String(product.lowStockLimit) : "")
  const [initial, setInitial] = React.useState("0")
  const [errors, setErrors] = React.useState<Errors>({})
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const inFlight = React.useRef(false)

  function validate(): Errors {
    const e: Errors = {}
    if (!name.trim()) e.name = "Informe o nome do produto."
    const normalizedSku = sku.trim().toUpperCase()
    if (!normalizedSku) e.sku = "Informe o SKU."
    else if (!SKU_PATTERN.test(normalizedSku)) e.sku = "Use de 2 a 20 letras, números ou hífens, como FER-1027."
    if (!categoryId) e.categoryId = "Escolha uma categoria."
    const p = parseBRL(price)
    if (p === null || p <= 0) e.price = "Informe um preço maior que zero."
    const l = Number(limit)
    if (limit.trim() === "" || !Number.isInteger(l) || l < 0) e.lowStockLimit = "Use um número inteiro, zero ou maior."
    if (!editing) {
      const q = Number(initial)
      if (initial.trim() === "" || !Number.isInteger(q) || q < 0) e.initialQuantity = "Use um número inteiro, zero ou maior."
    }
    return e
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (inFlight.current) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0]
      document.getElementById(`prd-${first}`)?.focus()
      return
    }
    inFlight.current = true
    setPending(true)
    setServerError(null)
    const draft = {
      name,
      sku: sku.trim().toUpperCase(),
      categoryId,
      price: parseBRL(price)!,
      lowStockLimit: Number(limit),
    }
    const result = editing
      ? await updateProduct(product.id, draft)
      : await createProduct({ ...draft, initialQuantity: Number(initial) })
    inFlight.current = false
    if (!result.ok) {
      // A field the API rejected (a taken SKU) gets the message in place;
      // anything else, like the 50-product cap, is said once for the form.
      // Render first: the fields are disabled while sending and cannot take focus.
      flushSync(() => {
        setPending(false)
        if (result.field) setErrors({ [result.field]: result.message })
        else setServerError(result.message)
      })
      if (result.field) document.getElementById(`prd-${result.field}`)?.focus()
      return
    }
    setPending(false)
    toast.success(editing ? "Produto atualizado" : "Produto cadastrado", { description: draft.name })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent busy={pending} className="sm:max-w-[560px]">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              {editing ? "Dados cadastrais. O saldo muda só por movimentações." : "Todos os campos são obrigatórios."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
              <Field id="prd-name" label="Nome" error={errors.name} className="sm:col-span-2">
                <Input
                  id="prd-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  placeholder="Ex.: Alicate de corte 6&quot;"
                  maxLength={80}
                />
              </Field>
              <Field id="prd-sku" label="SKU" error={errors.sku} hint="Código único no catálogo.">
                <Input
                  id="prd-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  aria-invalid={!!errors.sku}
                  placeholder="FER-1410"
                  className="sku uppercase"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={20}
                />
              </Field>
              <Field id="prd-categoryId" label="Categoria" error={errors.categoryId}>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="prd-categoryId" className="w-full" aria-invalid={!!errors.categoryId}>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="prd-price" label="Preço unitário" error={errors.price}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[15px] text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="prd-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    aria-invalid={!!errors.price}
                    placeholder="0,00"
                    className="pl-10 tabular-nums"
                  />
                </div>
              </Field>
              <Field
                id="prd-lowStockLimit"
                label="Limite de estoque baixo"
                error={errors.lowStockLimit}
                hint="Com saldo igual ou menor, o produto entra na fila de estoque baixo."
              >
                <Input
                  id="prd-lowStockLimit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  aria-invalid={!!errors.lowStockLimit}
                  className="tabular-nums"
                  placeholder="Ex.: 5"
                />
              </Field>

              {editing ? (
                <div className="flex flex-col gap-3 rounded-lg border border-[#c9d1ce] bg-well p-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <InfoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" weight="bold" />
                    <p className="text-sm leading-relaxed">
                      Saldo atual: <strong className="readout text-lg">{formatInt(product.balance)}</strong> un.
                      <br />
                      <span className="text-muted-foreground">Para corrigir o saldo, registre um ajuste.</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false)
                      openMovement({ productId: product.id, type: "ajuste" })
                    }}
                  >
                    <ArrowsDownUpIcon weight="bold" />
                    Registrar ajuste
                  </Button>
                </div>
              ) : (
                <Field
                  id="prd-initialQuantity"
                  label="Quantidade inicial"
                  error={errors.initialQuantity}
                  hint="Vira uma entrada no histórico. Depois, o saldo só muda por movimentações."
                  className="sm:col-span-2"
                >
                  <Input
                    id="prd-initialQuantity"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={initial}
                    onChange={(e) => setInitial(e.target.value)}
                    aria-invalid={!!errors.initialQuantity}
                    className="max-w-40 tabular-nums"
                  />
                </Field>
              )}
            </fieldset>
            {serverError ? (
              <p role="alert" className="mt-5 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-[#7d2616]">
                {serverError}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : null}
              {pending ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid content-start gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-erro`} role="alert" className="text-[13px] font-medium text-[#773226]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
