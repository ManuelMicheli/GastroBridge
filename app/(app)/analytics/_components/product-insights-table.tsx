"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { MACRO_CATEGORY_COLORS } from "@/lib/analytics/category-colors";
import { MACRO_CATEGORY_LABELS } from "@/lib/analytics/category-keywords";
import type { ProductInsightRow } from "@/lib/analytics/restaurant";

type Props = {
  rows: ProductInsightRow[];
};

export function ProductInsightsTable({ rows }: Props) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
      <h3 className="font-semibold text-text-primary mb-1">Top prodotti & variazione prezzi</h3>
      <p className="text-xs text-text-tertiary mb-4">
        I 15 prodotti con maggiore spesa nel periodo. Δ prezzo confrontato con periodo precedente.
      </p>
      {rows.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-text-tertiary">
          Nessun prodotto rilevato
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-tertiary uppercase tracking-wider border-b border-border-subtle">
                <th className="px-5 py-2 font-medium">Prodotto</th>
                <th className="px-3 py-2 font-medium text-right">Spesa</th>
                <th className="px-3 py-2 font-medium text-right">Q.tà</th>
                <th className="px-3 py-2 font-medium text-right">Prezzo medio</th>
                <th className="px-5 py-2 font-medium text-right">Δ prezzo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const priceDelta = row.priceDeltaPct;
                let deltaNode;
                if (priceDelta === null) {
                  deltaNode = <span className="text-text-tertiary text-xs">—</span>;
                } else if (Math.abs(priceDelta) < 0.5) {
                  deltaNode = (
                    <span className="inline-flex items-center gap-0.5 text-xs text-text-tertiary">
                      <Minus className="h-3 w-3" />
                      {priceDelta.toFixed(1)}%
                    </span>
                  );
                } else if (priceDelta > 0) {
                  deltaNode = (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent-red">
                      <ArrowUp className="h-3 w-3" />
                      {priceDelta.toFixed(1)}%
                    </span>
                  );
                } else {
                  deltaNode = (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent-green">
                      <ArrowDown className="h-3 w-3" />
                      {Math.abs(priceDelta).toFixed(1)}%
                    </span>
                  );
                }
                return (
                  <tr
                    key={row.name + row.category}
                    className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: MACRO_CATEGORY_COLORS[row.category] }}
                          title={MACRO_CATEGORY_LABELS[row.category]}
                        />
                        <span className="text-text-primary truncate max-w-[200px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-text-primary">
                      {formatCurrency(row.totalSpend)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary">
                      {row.quantity.toLocaleString("it-IT")}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary">
                      {formatCurrency(row.avgUnitPrice)}
                    </td>
                    <td className="px-5 py-3 text-right">{deltaNode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
