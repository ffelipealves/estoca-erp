import type { Product } from "@/lib/api";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  maximumFractionDigits: 2,
  style: "currency",
});

interface InventorySummaryProps {
  products: Product[];
}

export function InventorySummary({ products }: InventorySummaryProps) {
  const totalUnits = products.reduce((total, product) => total + product.quantity, 0);
  const inventoryValue = products.reduce(
    (total, product) => total + Number(product.price) * product.quantity,
    0,
  );
  const activeCategories = new Set(products.map((product) => product.category_id)).size;
  const lowStockProducts = [...products]
    .filter((product) => product.quantity <= product.low_stock_threshold)
    .sort(
      (left, right) =>
        left.quantity - left.low_stock_threshold -
          (right.quantity - right.low_stock_threshold) ||
        left.name.localeCompare(right.name, "pt-BR"),
    );

  return (
    <section
      aria-labelledby="inventory-summary-title"
      className="mt-8 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)] lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.85fr)]"
    >
      <div className="min-w-0 lg:flex lg:flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-stone-300 px-5 py-5 sm:px-6">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
              Fechamento da sessão · agora
            </p>
            <h2
              className="mt-1 font-display text-2xl font-bold tracking-tight text-[#17201d]"
              id="inventory-summary-title"
            >
              Pulso do estoque
            </h2>
          </div>
          <span className="rounded-full border border-stone-300 bg-stone-100 px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            {products.length === 1 ? "1 SKU" : `${products.length} SKUs`}
          </span>
        </div>

        <dl className="grid sm:grid-cols-3 lg:flex-1">
          <div className="border-b border-stone-200 px-5 py-6 sm:border-b-0 sm:border-r sm:px-6 lg:flex lg:flex-col lg:justify-center">
            <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Valor armazenado
            </dt>
            <dd className="mt-3 font-display text-3xl font-bold tracking-tight text-[#17201d]">
              {currencyFormatter.format(inventoryValue)}
            </dd>
            <p className="mt-2 text-xs leading-5 text-stone-500">Preço atual × saldo disponível</p>
          </div>
          <div className="border-b border-stone-200 px-5 py-6 sm:border-b-0 sm:border-r sm:px-6 lg:flex lg:flex-col lg:justify-center">
            <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Unidades em mãos
            </dt>
            <dd className="mt-3 font-display text-4xl font-bold leading-none text-[#17201d]">
              {totalUnits}
            </dd>
            <p className="mt-2 text-xs leading-5 text-stone-500">Somadas em todo o catálogo</p>
          </div>
          <div className="px-5 py-6 sm:px-6 lg:flex lg:flex-col lg:justify-center">
            <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Categorias ativas
            </dt>
            <dd className="mt-3 font-display text-4xl font-bold leading-none text-[#17201d]">
              {activeCategories}
            </dd>
            <p className="mt-2 text-xs leading-5 text-stone-500">Com ao menos um produto</p>
          </div>
        </dl>
      </div>

      <div className="border-t border-amber-900/15 bg-[#f5dfaa] lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-3 border-b border-amber-900/15 px-5 py-5">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-amber-900/65">
              Fila de reposição
            </p>
            <h3 className="mt-1 font-display text-2xl font-bold text-[#352b18]">
              {lowStockProducts.length === 0
                ? "Tudo abastecido"
                : `${lowStockProducts.length} ${lowStockProducts.length === 1 ? "item pede" : "itens pedem"} atenção`}
            </h3>
          </div>
          <span
            aria-label={`${lowStockProducts.length} produtos com estoque baixo`}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-amber-900/20 bg-[#fff8e7] font-display text-xl font-bold text-amber-950"
          >
            {lowStockProducts.length}
          </span>
        </div>

        {lowStockProducts.length === 0 ? (
          <p className="px-5 py-6 text-sm leading-6 text-amber-950/70">
            Nenhum saldo atingiu o ponto mínimo configurado.
          </p>
        ) : (
          <ol className="divide-y divide-amber-900/15">
            {lowStockProducts.slice(0, 4).map((product, index) => (
              <li className="flex items-center gap-3 px-5 py-3.5" key={product.id}>
                <span className="font-mono text-[10px] font-semibold text-amber-900/45">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#352b18]">{product.name}</p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-900/55">
                    SKU {product.sku}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl font-bold leading-none text-amber-950">
                    {product.quantity}
                  </p>
                  <p className="mt-1 text-[10px] text-amber-900/60">
                    mínimo {product.low_stock_threshold}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        {lowStockProducts.length > 4 ? (
          <p className="border-t border-amber-900/15 px-5 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-900/60">
            + {lowStockProducts.length - 4} na lista completa abaixo
          </p>
        ) : null}
      </div>
    </section>
  );
}
