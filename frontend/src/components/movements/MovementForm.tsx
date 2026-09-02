"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  ApiError,
  createStockMovement,
  type Product,
  type StockMovement,
  type StockMovementType,
} from "@/lib/api";

interface MovementFormProps {
  onCancel: () => void;
  onCreated: (movement: StockMovement) => void;
  products: Product[];
}

const movementOptions: Array<{
  description: string;
  label: string;
  type: StockMovementType;
}> = [
  {
    description: "Soma unidades ao saldo atual",
    label: "Entrada",
    type: "entrada",
  },
  {
    description: "Retira unidades disponíveis",
    label: "Saída",
    type: "saida",
  },
  {
    description: "Define o saldo final contado",
    label: "Ajuste",
    type: "ajuste",
  },
];

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Não foi possível registrar a movimentação. Verifique a conexão e tente novamente.";
}

function quantityLabel(type: StockMovementType): string {
  if (type === "entrada") return "Quantidade recebida";
  if (type === "saida") return "Quantidade retirada";
  return "Novo saldo absoluto";
}

export function MovementForm({ onCancel, onCreated, products }: MovementFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [type, setType] = useState<StockMovementType>("entrada");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) ?? null,
    [productId, products],
  );
  const numericQuantity = Number(quantity);
  const projectedBalance = selectedProduct
    ? type === "entrada"
      ? selectedProduct.quantity + numericQuantity
      : type === "saida"
        ? selectedProduct.quantity - numericQuantity
        : numericQuantity
    : 0;
  const hasValidQuantity =
    Number.isInteger(numericQuantity) &&
    (type === "ajuste" ? numericQuantity >= 0 : numericQuantity > 0);
  const hasEnoughStock =
    type !== "saida" || !selectedProduct || numericQuantity <= selectedProduct.quantity;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const movement = await createStockMovement({
        note: note.trim() || undefined,
        product_id: productId,
        quantity: numericQuantity,
        type,
      });
      onCreated(movement);
    } catch (error: unknown) {
      setErrorMessage(describeError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="border-b border-stone-300 bg-[#eef2e9] px-5 py-6 sm:px-6"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
            Ordem de movimentação · novo lançamento
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#17201d]">
            Alterar saldo de estoque
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Cada lançamento atualiza o produto e grava o saldo resultante no histórico.
          </p>
        </div>
        <button
          className="self-start text-sm font-semibold text-stone-500 underline decoration-stone-400/50 underline-offset-4 transition hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          onClick={onCancel}
          type="button"
        >
          Fechar ordem
        </button>
      </div>

      {products.length === 0 ? (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cadastre um produto antes de registrar movimentações.
        </div>
      ) : (
        <>
          <fieldset className="mt-6">
            <legend className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              Tipo de operação
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {movementOptions.map((option) => (
                <label
                  className={`cursor-pointer rounded-xl border p-3 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700 ${
                    type === option.type
                      ? "border-emerald-700 bg-white shadow-[inset_0_-3px_0_rgba(5,150,105,0.16)]"
                      : "border-stone-300 bg-white/60 hover:border-stone-400"
                  }`}
                  key={option.type}
                >
                  <input
                    checked={type === option.type}
                    className="sr-only"
                    disabled={isSubmitting}
                    name="movement-type"
                    onChange={() => {
                      setType(option.type);
                      setQuantity(option.type === "ajuste" ? String(selectedProduct?.quantity ?? 0) : "1");
                      setErrorMessage(null);
                    }}
                    type="radio"
                    value={option.type}
                  />
                  <span className="block font-display text-xl font-bold text-[#17201d]">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(220px,1.4fr)_minmax(170px,0.7fr)_minmax(220px,1fr)]">
            <label>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                Produto
              </span>
              <select
                autoFocus
                className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:cursor-wait disabled:bg-stone-100"
                disabled={isSubmitting}
                onChange={(event) => {
                  const nextProduct = products.find(
                    (product) => product.id === event.target.value,
                  );
                  setProductId(event.target.value);
                  if (type === "ajuste") setQuantity(String(nextProduct?.quantity ?? 0));
                }}
                required
                value={productId}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · saldo {product.quantity}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                {quantityLabel(type)}
              </span>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-display text-xl font-bold text-stone-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:cursor-wait disabled:bg-stone-100"
                disabled={isSubmitting}
                max={type === "saida" ? selectedProduct?.quantity : undefined}
                min={type === "ajuste" ? 0 : 1}
                onChange={(event) => setQuantity(event.target.value)}
                required
                step="1"
                type="number"
                value={quantity}
              />
            </label>

            <div className="rounded-xl border border-dashed border-stone-300 bg-white/70 p-3">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Prévia do saldo
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-[#17201d]">
                  {selectedProduct?.quantity ?? 0}
                </span>
                <span className="text-stone-400">→</span>
                <span className={`font-display text-3xl font-bold ${projectedBalance < 0 ? "text-rose-700" : "text-emerald-800"}`}>
                  {Number.isFinite(projectedBalance) ? projectedBalance : "—"}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {type === "ajuste"
                  ? "O valor informado será o novo saldo final."
                  : "A operação será aplicada ao saldo atual."}
              </p>
            </div>
          </div>

          <label className="mt-5 block max-w-3xl">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              Observação opcional
            </span>
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:cursor-wait disabled:bg-stone-100"
              disabled={isSubmitting}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: Recebimento do fornecedor ou correção após inventário"
              value={note}
            />
          </label>
        </>
      )}

      {!hasEnoughStock && selectedProduct ? (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          A saída supera o saldo disponível de {selectedProduct.quantity} unidades.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#17201d] px-5 text-sm font-bold text-white shadow-[0_3px_0_#0f8a5f] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            isSubmitting ||
            products.length === 0 ||
            !productId ||
            !hasValidQuantity ||
            !hasEnoughStock
          }
          type="submit"
        >
          {isSubmitting ? "Registrando..." : "Registrar movimentação"}
        </button>
        <button
          className="h-11 px-3 text-sm font-semibold text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
