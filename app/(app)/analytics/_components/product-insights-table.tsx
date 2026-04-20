"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { MACRO_CATEGORY_COLORS } from "@/lib/analytics/category-colors";
import { MACRO_CATEGORY_LABELS } from "@/lib/analytics/category-keywords";
import type { ProductInsightRow } from "@/lib/analytics/restaurant";

type Props = {
  rows: ProductInsightRow[];
};

function DeltaPill({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
        —
      </span>
    );
  }
  if (Math.abs(pct) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums text-text-tertiary">
        <Minus className="h-2.5 w-2.5" />
        {pct.toFixed(1)}%
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums text-accent-red">
        <ArrowUp className="h-2.5 w-2.5" />
        {pct.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums text-accent-green">
      <ArrowDown className="h-2.5 w-2.5" />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function ProductInsightsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun prodotto rilevato
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            <th className="px-4 py-2 font-medium">Prodotto</th>
            <th className="px-2 py-2 text-right font-medium">Spesa</th>
            <th className="px-2 py-2 text-right font-medium">Q.tà</th>
            <th className="px-2 py-2 text-right font-medium">€ medio</th>
            <th className="px-4 py-2 text-right font-medium">Δ prezzo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.name + row.category}
              className="border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover"
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: MACRO_CATEGORY_COLORS[row.category],
                    }}
                    title={MACRO_CATEGORY_LABELS[row.category]}
                  />
                  <span className="truncate text-[13px] text-text-primary">
                    {row.name}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-text-primary">
                {formatCurrency(row.totalSpend)}
              </td>
              <td className="px-2 py-2.5 text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {row.quantity.toLocaleString("it-IT")}
              </td>
              <td className="px-2 py-2.5 text-right font-mono text-[12px] tabular-nums text-text-secondary">
                {formatCurrency(row.avgUnitPrice)}
              </td>
              <td className="px-4 py-2.5 text-right">
                <DeltaPill pct={row.priceDeltaPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
