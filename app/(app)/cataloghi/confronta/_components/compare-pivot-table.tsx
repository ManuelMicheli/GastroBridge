// app/(app)/cataloghi/confronta/_components/compare-pivot-table.tsx
//
// Terminal-styled desktop pivot table. Products down, suppliers across.
// Best-price cell is ALWAYS rendered in accent-green, independent of the
// row's composite score (prevents a best-price cell turning yellow/orange
// when the same offer scores poorly on delivery weights, etc). Non-best
// cells stay in plain text-text-primary for clarity — the score shows up
// inside the tooltip breakdown on click.

"use client";

import type { SupplierCol, Pivot } from "@/lib/catalogs/compare";
import type { ScoreBreakdown } from "@/lib/scoring";
import { BreakdownTooltip } from "@/components/shared/scoring/breakdown-tooltip";

type RowScores = Map<string, { score: number; breakdown: ScoreBreakdown }>;

type Props = {
  filteredSuppliers: SupplierCol[];
  visibleRows: Pivot["rows"];
  totals: Pivot["totals"];
  basketOptimalPrice: number;
  saving: number;
  savingPct: number;
  scoresByRow: Map<string, RowScores>;
};

export function ComparePivotTable({
  filteredSuppliers,
  visibleRows,
  totals,
  basketOptimalPrice,
  saving,
  savingPct,
  scoresByRow,
}: Props) {
  const colSpanTotal = filteredSuppliers.length + 3;

  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-border-subtle bg-surface-card">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-surface-base/40">
            <th className="sticky left-0 z-10 border-b border-border-subtle bg-surface-base/60 px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
              Prodotto
            </th>
            <th className="border-b border-border-subtle px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
              Unità
            </th>
            {filteredSuppliers.map((s) => (
              <th
                key={s.id}
                className="border-b border-l border-border-subtle px-3 py-2 text-right font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-secondary"
              >
                {s.supplier_name}
              </th>
            ))}
            <th className="border-b border-l border-border-subtle px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
              Miglior prezzo
            </th>
          </tr>
        </thead>

        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={colSpanTotal}
                className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-wide text-text-tertiary"
              >
                Nessun prodotto da confrontare
              </td>
            </tr>
          ) : (
            visibleRows.map((r, idx) => {
              const rowScores = scoresByRow.get(r.key);
              const bestSupplierName = supplierName(
                filteredSuppliers,
                r.bestPriceSupplierId,
              );
              return (
                <tr
                  key={r.key}
                  className={`group border-l-2 border-transparent transition-colors hover:border-l-accent-green/50 hover:bg-surface-hover ${
                    idx % 2 === 1 ? "bg-surface-base/20" : ""
                  }`}
                >
                  <td className="border-b border-border-subtle/60 px-3 py-2 align-middle text-[13px] text-text-primary">
                    {r.productName}
                  </td>
                  <td className="border-b border-border-subtle/60 px-3 py-2 align-middle font-mono text-[11px] text-text-tertiary">
                    {r.unit}
                  </td>

                  {filteredSuppliers.map((s) => {
                    const p = r.prices[s.id];
                    const isBest = r.bestPriceSupplierId === s.id;
                    const cell = rowScores?.get(s.id);

                    const cellBase =
                      "border-b border-l border-border-subtle/60 px-3 py-2 align-middle text-right font-mono text-[13px] tabular-nums";
                    const cellTone = isBest
                      ? "bg-accent-green/10 text-accent-green font-semibold"
                      : "text-text-primary";

                    return (
                      <td key={s.id} className={`${cellBase} ${cellTone}`}>
                        {p == null ? (
                          <span className="font-normal text-text-tertiary">
                            —
                          </span>
                        ) : cell ? (
                          <details className="relative">
                            <summary className="list-none cursor-pointer decoration-dotted underline-offset-4 hover:underline">
                              € {p.toFixed(2)}
                            </summary>
                            <div className="absolute right-0 top-full z-20 mt-1 text-left">
                              <BreakdownTooltip breakdown={cell.breakdown} />
                            </div>
                          </details>
                        ) : (
                          <span>€ {p.toFixed(2)}</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="border-b border-l border-border-subtle/60 px-3 py-2 align-middle font-mono text-[12px] text-accent-green">
                    {bestSupplierName}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>

        <tfoot>
          <tr aria-hidden>
            <td
              colSpan={colSpanTotal}
              className="h-2 border-t-2 border-border-subtle bg-surface-base/30 p-0"
            />
          </tr>
          <tr className="bg-surface-base/40">
            <td
              colSpan={2}
              className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary"
            >
              Totale fornitore
            </td>
            {filteredSuppliers.map((s) => {
              const total = totals[s.id] ?? 0;
              const isOptimal = pivotSupplierIsMin(totals, s.id);
              return (
                <td
                  key={s.id}
                  className={`border-l border-border-subtle px-3 py-2 text-right font-mono text-[12px] tabular-nums ${
                    isOptimal ? "text-accent-green" : "text-text-primary"
                  }`}
                >
                  € {total.toFixed(2)}
                </td>
              );
            })}
            <td className="border-l border-border-subtle" />
          </tr>
          <tr className="border-t border-border-subtle/60 bg-accent-green/5">
            <td
              colSpan={2}
              className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green"
            >
              Basket ottimale
            </td>
            <td
              colSpan={filteredSuppliers.length}
              className="border-l border-border-subtle/60 px-3 py-2 text-right font-mono text-[13px] font-semibold tabular-nums text-accent-green"
            >
              € {basketOptimalPrice.toFixed(2)}
            </td>
            <td className="border-l border-border-subtle/60" />
          </tr>
          {saving > 0 && (
            <tr className="border-t border-border-subtle/60 bg-surface-base/20">
              <td
                colSpan={colSpanTotal}
                className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green"
              >
                Risparmio{" "}
                <span className="tabular-nums">€ {saving.toFixed(2)}</span>
                <span className="mx-2 text-accent-green/40">·</span>
                <span className="tabular-nums">{savingPct.toFixed(0)}%</span>
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

function supplierName(suppliers: SupplierCol[], id: string | null): string {
  if (!id) return "—";
  return suppliers.find((s) => s.id === id)?.supplier_name ?? "—";
}

/** True when `supplierId` has the strictly lowest total (>0) in `totals`.
 *  Ties and zero totals return false — no supplier is singled out. */
function pivotSupplierIsMin(
  totals: Record<string, number>,
  supplierId: string,
): boolean {
  const entries = Object.entries(totals).filter(([, v]) => v > 0);
  if (entries.length < 2) return false;
  const min = Math.min(...entries.map(([, v]) => v));
  const minCount = entries.filter(([, v]) => v === min).length;
  if (minCount > 1) return false;
  const own = totals[supplierId] ?? 0;
  return own === min;
}
