"use client"

import * as React from "react"
import { toast } from "sonner"
import { CircleNotchIcon, MinusIcon, PlusIcon, WarningIcon } from "@phosphor-icons/react"
import type { MovementPreset } from "@/lib/estoca/store"
import { useActions, useEstoca } from "@/lib/estoca/store"
import { MOVEMENT_META, checkMovement } from "@/lib/estoca/rules"
import { formatInt } from "@/lib/estoca/format"
import type { MovementType } from "@/lib/estoca/types"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { OpGlyph } from "./op-glyph"
import { RollingNumber } from "./rolling-number"
import { Kbd } from "./kbd"
import { cn } from "@/lib/utils"

const TYPES: MovementType[] = ["entrada", "saida", "ajuste"]

/** Function keys: E, S, A pick the operation when focus is not in a text field. */
const TYPE_KEY: Record<MovementType, string> = { entrada: "E", saida: "S", ajuste: "A" }
const KEY_TYPE: Record<string, MovementType> = { e: "entrada", s: "saida", a: "ajuste" }

export function MovementDialog({
  open,
  preset,
  onOpenChange,
}: {
  open: boolean
  preset: MovementPreset
  onOpenChange(open: boolean): void
}) {
  const { products, catalogStatus } = useEstoca()
  const { registerMovement } = useActions()
  const [productId, setProductId] = React.useState(preset.productId ?? "")
  const [type, setType] = React.useState<MovementType>(preset.type ?? "entrada")
  const [quantityText, setQuantityText] = React.useState("")
  const [note, setNote] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [touched, setTouched] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const inFlight = React.useRef(false)

  const sorted = React.useMemo(() => products.toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR")), [products])
  const product = products.find((p) => p.id === productId)
  const quantity = quantityText.trim() === "" ? null : Number(quantityText)
  const check = checkMovement(product, type, quantity)
  const meta = MOVEMENT_META[type]
  const showError = touched && !check.ok && check.reason !== "sem-produto"

  function changeType(next: MovementType) {
    setType(next)
    setServerError(null)
    // A count is a different number than a delta: never carry it across.
    if (next === "ajuste" || type === "ajuste") setQuantityText("")
    setTouched(false)
  }

  function onFunctionKey(e: React.KeyboardEvent) {
    if (pending || e.metaKey || e.ctrlKey || e.altKey) return
    const next = KEY_TYPE[e.key.toLowerCase()]
    if (!next) return
    const target = e.target as HTMLElement
    if (target.closest("textarea, [role=combobox], [role=listbox]")) return
    if (target instanceof HTMLInputElement && target.type !== "radio") return
    e.preventDefault()
    changeType(next)
  }

  function step(delta: number) {
    const base = quantity ?? (type === "ajuste" ? (product?.balance ?? 0) : 0)
    setQuantityText(String(Math.max(0, base + delta)))
    setTouched(true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (inFlight.current || !check.ok || quantity === null) return
    inFlight.current = true
    setPending(true)
    setServerError(null)
    const result = await registerMovement({ productId, type, quantity, note })
    inFlight.current = false
    setPending(false)
    if (!result.ok) {
      setServerError(result.message)
      return
    }
    toast.success(meta.done, {
      description: `${product!.name}: saldo agora é ${formatInt(result.value.resultingBalance)}.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent busy={pending} className="sm:max-w-[600px]">
        <form onSubmit={onSubmit} onKeyDown={onFunctionKey} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>Registrar movimentação</DialogTitle>
            <DialogDescription>O saldo só muda depois que você confirmar.</DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="mov-product">Produto</Label>
              <Select
                value={productId}
                onValueChange={(v) => {
                  setProductId(v)
                  setServerError(null)
                }}
                disabled={pending}
              >
                <SelectTrigger id="mov-product" className="w-full" aria-invalid={touched && !product}>
                  <SelectValue
                    placeholder={catalogStatus === "ready" ? "Escolha o produto" : "Carregando produtos…"}
                  />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  {sorted.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="truncate">{p.name}</span>
                      <span className="sku ml-auto shrink-0 pl-3 text-[13px] text-muted-foreground">{p.sku}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched && !product ? <FieldError>Escolha o produto.</FieldError> : null}
            </div>

            <fieldset className="grid gap-2" disabled={pending}>
              <legend className="mb-2 text-sm font-semibold">
                Operação{" "}
                <span className="hidden font-normal text-muted-foreground sm:inline">(teclas E, S ou A)</span>
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const selected = t === type
                  return (
                    <label
                      key={t}
                      className={cn(
                        "flex cursor-pointer flex-col items-start gap-2 rounded-md border px-3 py-2.5 transition-[background-color,border-color,box-shadow,transform] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring sm:flex-row sm:items-center",
                        selected
                          ? "translate-y-px border-rail bg-secondary shadow-[inset_0_2px_0_rgb(27_31_34/0.14)]"
                          : "border-input bg-card shadow-[inset_0_-2px_0_rgb(27_31_34/0.07)] hover:border-[#9aa4a1]",
                      )}
                    >
                      <input
                        type="radio"
                        name="mov-type"
                        value={t}
                        checked={selected}
                        onChange={() => changeType(t)}
                        className="sr-only"
                      />
                      <OpGlyph type={t} />
                      <span className="font-semibold">{MOVEMENT_META[t].label}</span>
                      <Kbd className="hidden sm:ml-auto sm:inline-flex">{TYPE_KEY[t]}</Kbd>
                    </label>
                  )
                })}
              </div>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground" aria-live="polite">
                <strong className="font-semibold text-foreground">{meta.label}:</strong> {meta.explain}
              </p>
            </fieldset>

            <div className="grid gap-2">
              <Label htmlFor="mov-qty">{meta.quantityLabel}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10"
                  onClick={() => step(-1)}
                  disabled={pending}
                  aria-label="Diminuir 1"
                >
                  <MinusIcon weight="bold" />
                </Button>
                <Input
                  id="mov-qty"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={quantityText}
                  onChange={(e) => {
                    setQuantityText(e.target.value)
                    setServerError(null)
                  }}
                  onBlur={() => setTouched(true)}
                  placeholder={type === "ajuste" ? "Quantas unidades você contou?" : "0"}
                  aria-invalid={showError}
                  aria-describedby="mov-qty-help mov-readout"
                  className="readout h-10 max-w-44 text-center text-[22px]"
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10"
                  onClick={() => step(1)}
                  disabled={pending}
                  aria-label="Aumentar 1"
                >
                  <PlusIcon weight="bold" />
                </Button>
              </div>
              <p id="mov-qty-help" className="text-[13px] text-muted-foreground">
                {type === "ajuste"
                  ? "Informe o total que existe fisicamente, não a diferença."
                  : "Unidades inteiras, maior que zero."}
              </p>
              {showError && !check.ok ? (
                <FieldError>
                  {check.message}
                  {check.reason === "saldo-insuficiente" && product && product.balance > 0 ? (
                    <Button
                      type="button"
                      variant="link"
                      className="ml-1.5 text-[13px] text-[#7d2616]"
                      onClick={() => setQuantityText(String(product.balance))}
                    >
                      Retirar tudo ({product.balance})
                    </Button>
                  ) : null}
                </FieldError>
              ) : null}
            </div>

            <Readout type={type} balance={product?.balance ?? null} quantity={quantity} check={check} limit={product?.lowStockLimit} />

            <div className="grid gap-2">
              <Label htmlFor="mov-note">
                Observação <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="mov-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  type === "entrada"
                    ? "Ex.: NF 18.620, fornecedor"
                    : type === "saida"
                      ? "Ex.: Pedido 5620"
                      : "Ex.: Contagem de fim de mês"
                }
                maxLength={140}
                disabled={pending}
              />
            </div>

            {serverError ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-[#7d2616]">
                {serverError}
              </p>
            ) : null}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="trigger" disabled={pending} aria-disabled={!check.ok}>
              {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : null}
              {pending ? "Registrando…" : meta.verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex flex-wrap items-center text-[13px] font-medium text-[#773226]">
      {children}
    </p>
  )
}

/**
 * The collector display, on the same graphite as the Painel: current balance,
 * the operation, and what the balance becomes. Ajuste reads as a replacement
 * (system count, then the counted final) and states the difference once.
 */
function Readout({
  type,
  balance,
  quantity,
  check,
  limit,
}: {
  type: MovementType
  balance: number | null
  quantity: number | null
  check: ReturnType<typeof checkMovement>
  limit?: number
}) {
  const hasProduct = balance !== null
  const raw =
    hasProduct && quantity !== null && Number.isFinite(quantity)
      ? type === "entrada"
        ? balance + quantity
        : type === "saida"
          ? balance - quantity
          : quantity
      : null
  const negative = raw !== null && raw < 0
  const finalText = raw === null ? "--" : negative ? `−${Math.abs(raw)}` : String(raw)
  const diff = raw !== null && balance !== null ? raw - balance : null
  const signed =
    quantity === null
      ? "?"
      : type === "entrada"
        ? `+${formatInt(quantity)}`
        : type === "saida"
          ? `−${formatInt(Math.abs(quantity))}`
          : null

  return (
    <div className="grid gap-3">
      <section
        id="mov-readout"
        aria-label="Prévia do saldo"
        className="on-rail rounded-lg bg-rail px-5 py-4 text-rail-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.3)]"
      >
        {!hasProduct ? (
          <p className="py-4 text-center text-sm text-rail-muted">Escolha um produto para ver o efeito no saldo.</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div>
                <p className="text-[13px] text-rail-muted">{type === "ajuste" ? "No sistema" : "Saldo atual"}</p>
                <p className="readout mt-1.5 text-[40px] text-rail-muted">{formatInt(balance)}</p>
              </div>
              <div className="flex flex-col items-center gap-1.5 pb-1">
                <OpGlyph type={type} size="lg" />
                {signed ? <span className="readout text-[22px]">{signed}</span> : null}
              </div>
              <div className="text-right">
                <p className="text-[13px] text-rail-muted">{type === "ajuste" ? "Saldo final (contado)" : "Saldo final"}</p>
                <p className={cn("readout mt-1.5 text-[40px]", negative && "text-[#ff9a86]")}>
                  <RollingNumber value={finalText} />
                </p>
              </div>
            </div>
            {type === "ajuste" ? (
              <p className="mt-3 border-t border-white/10 pt-3 text-sm text-rail-muted">
                {diff === null ? (
                  "Informe a contagem para ver a diferença."
                ) : diff === 0 ? (
                  "A contagem é igual ao sistema: não há o que ajustar."
                ) : (
                  <>
                    O ajuste registra uma diferença de{" "}
                    <strong className="readout text-lg text-rail-foreground">
                      {diff > 0 ? "+" : "−"}
                      {formatInt(Math.abs(diff))}
                    </strong>{" "}
                    un. Não soma: substitui o saldo.
                  </>
                )}
              </p>
            ) : null}
            <p className="sr-only" aria-live="polite">
              {raw === null ? "" : `Saldo final: ${finalText}`}
            </p>
          </>
        )}
      </section>

      {check.ok && check.fallsBelowLimit && limit !== undefined ? (
        <p className="flex items-start gap-2 rounded-md bg-warn-soft px-3 py-2 text-[13px] text-warn">
          <WarningIcon className="mt-px size-4 shrink-0" weight="bold" />
          O saldo final fica no mínimo definido ({formatInt(limit)}) ou abaixo dele. O produto entra na fila de estoque
          baixo.
        </p>
      ) : null}
      {negative ? (
        <p className="text-[13px] font-medium text-[#773226]">Uma saída não pode deixar o saldo negativo.</p>
      ) : null}
    </div>
  )
}
