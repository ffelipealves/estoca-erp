"use client"

import * as React from "react"
import { toast } from "sonner"
import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react"
import { listStockMovements } from "@/lib/api"
import { useActions } from "@/lib/estoca/store"
import { useApiQuery } from "@/lib/estoca/use-api-query"
import { formatInt, pluralize } from "@/lib/estoca/format"
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

export function DeleteProductDialog({
  product,
  onOpenChange,
}: {
  product: Product | null
  onOpenChange(open: boolean): void
}) {
  const { deleteProduct } = useActions()
  const [confirmed, setConfirmed] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [snapshot, setSnapshot] = React.useState<Product | null>(product)
  const inFlight = React.useRef(false)

  // Keep showing the product while the dialog animates out.
  if (product && product !== snapshot) {
    setSnapshot(product)
    setConfirmed(false)
    setError(null)
  }
  const shown = product ?? snapshot
  const shownId = shown?.id
  // How much history goes with it: one count from the API when the dialog opens.
  const loadCount = React.useCallback(
    (signal: AbortSignal) =>
      shownId ? listStockMovements(1, 1, { productId: shownId }, signal).then((page) => page.total) : Promise.resolve(0),
    [shownId],
  )
  const count = useApiQuery(loadCount, "Não foi possível contar as movimentações do produto.")
  const history = count.data

  async function onConfirm() {
    if (!shown || !confirmed || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    const result = await deleteProduct(shown.id)
    inFlight.current = false
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    toast.success("Produto excluído", {
      description:
        history === null
          ? `${shown.name} e o histórico dele foram removidos.`
          : `${shown.name} e ${pluralize(history, "movimentação", "movimentações")} removidos.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={!!product} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent busy={pending} role="alertdialog" className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Excluir {shown?.name}?</DialogTitle>
          <DialogDescription>
            SKU <span className="sku font-semibold text-foreground">{shown?.sku}</span>, saldo atual{" "}
            {formatInt(shown?.balance ?? 0)} un.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4 text-[15px] leading-relaxed">
          <div className="rounded-lg bg-danger-soft p-4 text-[#6e2213]">
            <p className="font-bold">O histórico vai junto.</p>
            <p className="mt-1">
              {history === null
                ? "As movimentações deste produto serão apagadas, e o painel deixa de contá-las."
                : history === 1
                  ? "A movimentação deste produto será apagada, e o painel deixa de contá-la."
                  : history > 1
                    ? `As ${pluralize(history, "movimentação", "movimentações")} deste produto serão apagadas, e o painel deixa de contá-las.`
                    : "Este produto não tem movimentações registradas."}{" "}
              Não dá para desfazer; só o reset da sandbox recria o catálogo inicial.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={pending}
              className="mt-1 size-4 accent-[#973c30]"
            />
            <span>Entendo que o produto e o histórico dele serão excluídos.</span>
          </label>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-[#7d2616]">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!confirmed || pending}>
            {pending ? <CircleNotchIcon className="animate-spin" weight="bold" /> : <TrashIcon weight="bold" />}
            {pending ? "Excluindo…" : "Excluir produto e histórico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
