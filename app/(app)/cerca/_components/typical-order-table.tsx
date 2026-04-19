// app/(app)/cerca/_components/typical-order-table.tsx
"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group, OrderLine, SupplierLite } from "../_lib/types";

type Computed = {
  line: OrderLine;
  available: boolean;
  bestPrice: number | null;
  bestSupplier: SupplierLite | null;
  bestLineTotal: number;
  bestScore: number;
};

export function TypicalOrderTable({
  lines,
  groupByKey,
  onUpdateQty,
  onRemove,
}: {
  lines: OrderLine[];
  groupByKey: Map<string, Group>;
  onUpdateQty: (key: string, raw: string) => void;
  onRemove: (key: string) => void;
}) {
  const computed: Computed[] = lines.map((line) => {
    const g = groupByKey.get(line.key);
    if (!g || g.offers.length === 0) {
      return { line, available: false, bestPrice: null, bestSupplier: null, bestLineTotal: 0, bestScore: 0 };
    }
    const top = g.offers[0]!;
    return {
      line,
      available: true,
      bestPrice: top.price,
      bestSupplier: top.supplier,
      bestLineTotal: top.price * line.qty,
      bestScore: top.scored.score,
    };
  });

  const basketOptimal = computed.reduce((s, c) => s + c.bestLineTotal, 0);

  return (
    <>
      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {computed.map(({ line, available, bestPrice, bestSupplier, bestLineTotal, bestScore }, i) => {
          const cls = available ? scoreColorClass(bestScore) : "text-text-tertiary";
          return (
            <li
              key={line.key}
              className="rounded-xl border border-border-subtle bg-surface-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[14px] font-medium text-text-primary">
                    <span className="font-mono text-[10px] text-text-tertiary tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{line.productName}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-tertiary">
                    {available && bestSupplier ? (
                      <Link href={`/cataloghi/${bestSupplier.id}`} className="text-accent-green hover:underline">
                        {bestSupplier.supplier_name}
                      </Link>
                    ) : (
                      <span>non disponibile</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(line.key)}
                  className="rounded p-2 text-red-400 hover:bg-red-500/10"
                  title="Rimuovi"
                  aria-label="Rimuovi"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={line.qty}
                    onChange={(e) => onUpdateQty(line.key, e.target.value)}
                    className="w-20 rounded-lg border border-border-subtle bg-surface-base px-2 py-1.5 text-right font-mono text-[14px] text-text-primary tabular-nums"
                    aria-label={`Quantità ${line.productName}`}
                  />
                  <span className="font-mono text-[11px] text-text-tertiary">{line.unit}</span>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-[11px] tabular-nums ${cls}`}>
                    {available ? `€ ${bestPrice!.toFixed(2)}` : "—"}
                  </p>
                  <p className="font-mono text-[15px] font-semibold tabular-nums text-text-primary">
                    {available ? `€ ${bestLineTotal.toFixed(2)}` : "—"}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            split ottimale
          </span>
          <span className="font-mono text-[16px] font-semibold tabular-nums text-accent-green">
            € {basketOptimal.toFixed(2)}
          </span>
        </li>
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border-subtle md:block">
      <table className="min-w-full text-[13px]">
        <thead className="bg-surface-card font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          <tr>
            <th className="px-3 py-2 text-left font-medium w-8">#</th>
            <th className="px-3 py-2 text-left font-medium">Prodotto</th>
            <th className="px-3 py-2 text-right font-medium">Q.tà</th>
            <th className="px-3 py-2 text-left font-medium">Unità</th>
            <th className="px-3 py-2 text-right font-medium">Best</th>
            <th className="px-3 py-2 text-left font-medium">Fornitore</th>
            <th className="px-3 py-2 text-right font-medium">Totale</th>
            <th className="px-3 py-2 w-8" />
          </tr>
        </thead>
        <tbody>
          {computed.map(({ line, available, bestPrice, bestSupplier, bestLineTotal, bestScore }, i) => {
            const cls = available ? scoreColorClass(bestScore) : "text-text-tertiary";
            return (
              <tr
                key={line.key}
                className="border-t border-border-subtle odd:bg-surface-base/30"
              >
                <td className="px-3 py-2 text-right font-mono text-[10px] text-text-tertiary tabular-nums">
                  {i + 1}
                </td>
                <td className="px-3 py-2 text-text-primary">{line.productName}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number" min={0} step="0.1"
                    value={line.qty}
                    onChange={(e) => onUpdateQty(line.key, e.target.value)}
                    className="w-20 rounded border border-border-subtle bg-surface-base px-2 py-1 text-right font-mono text-text-primary tabular-nums"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-text-tertiary">{line.unit}</td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${cls}`}>
                  {available ? `€ ${bestPrice!.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2">
                  {available && bestSupplier ? (
                    <Link href={`/cataloghi/${bestSupplier.id}`} className="text-accent-green hover:underline">
                      {bestSupplier.supplier_name}
                    </Link>
                  ) : (
                    <span className="text-xs text-text-tertiary">non disponibile</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary tabular-nums">
                  {available ? `€ ${bestLineTotal.toFixed(2)}` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onRemove(line.key)}
                    className="rounded p-1.5 text-red-400 opacity-40 hover:bg-red-500/10 hover:opacity-100"
                    title="Rimuovi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-surface-card">
          <tr className="border-t border-border-subtle">
            <td colSpan={6} className="px-3 py-2 text-right font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
              split ottimale
            </td>
            <td className="px-3 py-2 text-right font-mono text-[14px] font-semibold tabular-nums text-accent-green">
              € {basketOptimal.toFixed(2)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
    </>
  );
}
