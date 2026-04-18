// app/(app)/cataloghi/confronta/_components/compare-mobile-list.tsx
//
// Mobile-only dense list of products. Each product card has a terminal
// mono header and a vertical list of supplier offers sorted by price
// ascending. The cheapest row renders in accent-green (always, regardless
// of composite score).

"use client";

import type { SupplierCol, Pivot } from "@/lib/catalogs/compare";

type Props = {
  filteredSuppliers: SupplierCol[];
  visibleRows: Pivot["rows"];
};

export function CompareMobileList({ filteredSuppliers, visibleRows }: Props) {
  if (visibleRows.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card p-6 text-center md:hidden">
        <p className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
          Nessun prodotto da confrontare
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:hidden">
      {visibleRows.map((r) => {
        const offers = filteredSuppliers
          .map((s) => ({ s, price: r.prices[s.id] }))
          .filter(
            (x): x is { s: SupplierCol; price: number } =>
              x.price !== null && x.price !== undefined,
          )
          .sort((a, b) => a.price - b.price);

        return (
          <article
            key={r.key}
            className="rounded-lg border border-border-subtle bg-surface-card"
          >
            <header className="flex items-baseline gap-2 border-b border-border-subtle/60 px-3 py-2">
              <span
                aria-hidden
                className="font-mono text-[10px] tracking-[0.08em] text-text-tertiary"
              >
                ─
              </span>
              <h3 className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.06em] text-text-primary">
                {r.productName}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
                {r.unit}
              </span>
            </header>

            <ul className="divide-y divide-border-subtle/40">
              {offers.length === 0 ? (
                <li className="px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
                  Nessuna offerta
                </li>
              ) : (
                offers.map(({ s, price }) => {
                  const isBest = r.bestPriceSupplierId === s.id;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-baseline justify-between px-3 py-1.5 text-[13px] ${
                        isBest ? "bg-accent-green/10" : ""
                      }`}
                    >
                      <span
                        className={
                          isBest
                            ? "text-accent-green font-medium"
                            : "text-text-secondary"
                        }
                      >
                        {s.supplier_name}
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          isBest
                            ? "text-accent-green font-semibold"
                            : "text-text-primary"
                        }`}
                      >
                        € {price.toFixed(2)}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
