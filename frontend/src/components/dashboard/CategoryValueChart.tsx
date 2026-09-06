import type { Category, Product } from "@/lib/api";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  style: "percent",
});

/** Além disso a leitura vira lista, não comparação: o excedente vira "Outras". */
const MAX_BARS = 6;

interface CategoryValueChartProps {
  categories: Category[];
  products: Product[];
}

interface Slice {
  items: number;
  name: string;
  value: number;
}

function buildSlices(products: Product[], categories: Category[]): Slice[] {
  const nameOf = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, Slice>();

  for (const product of products) {
    const name = nameOf.get(product.category_id) ?? "Sem categoria";
    const current = totals.get(name) ?? { items: 0, name, value: 0 };
    current.items += 1;
    current.value += Number(product.price) * product.quantity;
    totals.set(name, current);
  }

  const ordered = [...totals.values()].sort(
    (left, right) =>
      right.value - left.value || left.name.localeCompare(right.name, "pt-BR"),
  );

  if (ordered.length <= MAX_BARS) return ordered;

  const head = ordered.slice(0, MAX_BARS - 1);
  const tail = ordered.slice(MAX_BARS - 1);
  return [
    ...head,
    {
      items: tail.reduce((total, slice) => total + slice.items, 0),
      name: "Outras",
      value: tail.reduce((total, slice) => total + slice.value, 0),
    },
  ];
}

export function CategoryValueChart({ categories, products }: CategoryValueChartProps) {
  const slices = buildSlices(products, categories);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const largest = Math.max(...slices.map((slice) => slice.value), 0);

  // Uma barra só não é um gráfico — sem comparação, o número do fechamento
  // já conta a história inteira.
  if (slices.length < 2 || largest <= 0) return null;

  return (
    <section
      aria-labelledby="category-value-title"
      className="mt-6 overflow-hidden rounded-2xl border border-stone-300 bg-[#fffdf8] shadow-[0_16px_45px_rgba(46,52,48,0.06)]"
    >
      <div className="border-b border-dashed border-stone-300 px-5 py-5 sm:px-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-800">
          Composição · preço × saldo
        </p>
        <h2
          className="mt-1 font-display text-2xl font-bold tracking-tight text-[#17201d]"
          id="category-value-title"
        >
          Valor por categoria
        </h2>
      </div>

      <ul className="divide-y divide-stone-200/70">
        {slices.map((slice) => {
          const share = total > 0 ? slice.value / total : 0;

          return (
            <li
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-stone-50/80 sm:grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)_auto] sm:px-6"
              key={slice.name}
              title={`${slice.name}: ${currencyFormatter.format(slice.value)} · ${percentFormatter.format(share)} do valor · ${slice.items} ${slice.items === 1 ? "produto" : "produtos"}`}
            >
              <span className="truncate text-sm font-semibold text-stone-800">
                {slice.name}
              </span>
              <span className="order-last col-span-2 h-3 rounded-[2px] bg-stone-200/70 sm:order-none sm:col-span-1">
                <span
                  className="block h-3 rounded-r-[4px] bg-[#0f8a5f]"
                  style={{
                    width: `${Math.max((slice.value / largest) * 100, 1.5)}%`,
                  }}
                />
              </span>
              <span className="text-right font-mono text-xs font-semibold tabular-nums text-stone-700">
                {currencyFormatter.format(slice.value)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-stone-200 px-5 py-3 text-xs leading-5 text-stone-500 sm:px-6">
        Cada barra soma preço × saldo dos produtos da categoria. Passe o cursor para
        ver a participação no valor total.
      </p>
    </section>
  );
}
