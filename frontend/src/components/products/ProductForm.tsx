"use client";

import { useState, type FormEvent } from "react";

import {
  ApiError,
  createProduct,
  updateProduct,
  type Category,
  type Product,
} from "@/lib/api";

interface ProductFormProps {
  categories: Category[];
  onCancel: () => void;
  onSaved: (product: Product) => void;
  product?: Product;
}

interface FormValues {
  categoryId: string;
  initialQuantity: string;
  lowStockThreshold: string;
  name: string;
  price: string;
  sku: string;
}

const initialValues: FormValues = {
  categoryId: "",
  initialQuantity: "0",
  lowStockThreshold: "5",
  name: "",
  price: "",
  sku: "",
};

function describeError(error: unknown, isEditing: boolean): string {
  if (error instanceof ApiError) return error.message;
  return `Não foi possível ${isEditing ? "salvar as alterações" : "cadastrar o produto"}. Verifique a conexão e tente novamente.`;
}

export function ProductForm({ categories, onCancel, onSaved, product }: ProductFormProps) {
  const isEditing = Boolean(product);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<FormValues>({
    ...initialValues,
    categoryId: product?.category_id ?? categories[0]?.id ?? "",
    lowStockThreshold: String(product?.low_stock_threshold ?? 5),
    name: product?.name ?? "",
    price: product?.price ?? "",
    sku: product?.sku ?? "",
  });

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const sharedPayload = {
        category_id: values.categoryId,
        low_stock_threshold: Number(values.lowStockThreshold),
        name: values.name.trim(),
        price: values.price.replace(",", "."),
        sku: values.sku.trim(),
      };
      const savedProduct = product
        ? await updateProduct(product.id, sharedPayload)
        : await createProduct({
            ...sharedPayload,
            initial_quantity: Number(values.initialQuantity),
          });
      onSaved(savedProduct);
    } catch (error: unknown) {
      setErrorMessage(describeError(error, isEditing));
    } finally {
      setIsSubmitting(false);
    }
  }

  const fieldClassName =
    "mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10 disabled:cursor-not-allowed disabled:bg-stone-100";
  const labelClassName =
    "font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600";

  return (
    <form
      className="border-b border-stone-300 bg-[#eef2e9] px-5 py-6 sm:px-6"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
            {isEditing ? `Ficha de revisão · ${product?.sku}` : "Ficha de entrada · novo item"}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#17201d]">
            {isEditing ? "Editar produto" : "Cadastrar produto"}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {isEditing
              ? "Altere os dados cadastrais. O saldo continua controlado pelas movimentações."
              : "A quantidade inicial gera automaticamente a primeira movimentação."}
          </p>
        </div>
        <button
          className="self-start text-sm font-semibold text-stone-500 underline decoration-stone-400/50 underline-offset-4 transition hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          onClick={onCancel}
          type="button"
        >
          Fechar ficha
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cadastre uma categoria antes de adicionar produtos.
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className={labelClassName}>Nome</span>
            <input
              autoFocus
              className={fieldClassName}
              disabled={isSubmitting}
              maxLength={150}
              onChange={(event) => updateValue("name", event.target.value)}
              placeholder="Ex.: Café em grãos"
              required
              value={values.name}
            />
          </label>

          <label className="lg:col-span-2">
            <span className={labelClassName}>SKU</span>
            <input
              autoCapitalize="characters"
              className={`${fieldClassName} font-mono uppercase`}
              disabled={isSubmitting}
              maxLength={50}
              onChange={(event) => updateValue("sku", event.target.value)}
              placeholder="Ex.: CAFE-001"
              required
              value={values.sku}
            />
          </label>

          <label className="lg:col-span-2">
            <span className={labelClassName}>Categoria</span>
            <select
              className={fieldClassName}
              disabled={isSubmitting}
              onChange={(event) => updateValue("categoryId", event.target.value)}
              required
              value={values.categoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="lg:col-span-2">
            <span className={labelClassName}>Preço unitário</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-sm text-stone-500">
                R$
              </span>
              <input
                className={`${fieldClassName} pl-10`}
                disabled={isSubmitting}
                inputMode="decimal"
                min="0.01"
                onChange={(event) => updateValue("price", event.target.value)}
                placeholder="0,00"
                required
                step="0.01"
                type="number"
                value={values.price}
              />
            </div>
          </label>

          {!isEditing ? (
            <label className="lg:col-span-2">
              <span className={labelClassName}>Quantidade inicial</span>
              <input
                className={fieldClassName}
                disabled={isSubmitting}
                min="0"
                onChange={(event) => updateValue("initialQuantity", event.target.value)}
                required
                step="1"
                type="number"
                value={values.initialQuantity}
              />
            </label>
          ) : null}

          <label className="lg:col-span-2">
            <span className={labelClassName}>Avisar estoque abaixo de</span>
            <input
              className={fieldClassName}
              disabled={isSubmitting}
              min="0"
              onChange={(event) => updateValue("lowStockThreshold", event.target.value)}
              required
              step="1"
              type="number"
              value={values.lowStockThreshold}
            />
          </label>
        </div>
      )}

      {errorMessage ? (
        <p
          className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#17201d] px-5 text-sm font-bold text-white shadow-[0_3px_0_#0f8a5f] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          disabled={isSubmitting || categories.length === 0}
          type="submit"
        >
          {isSubmitting
            ? isEditing
              ? "Salvando..."
              : "Cadastrando..."
            : isEditing
              ? "Salvar alterações"
              : "Cadastrar produto"}
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
