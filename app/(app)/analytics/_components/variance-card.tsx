"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { VarianceRow } from "@/lib/analytics/restaurant";

type Props = {
  delta: number;
  deltaPct: number | null;
  topByCategory: VarianceRow[];
  topBySupplier: VarianceRow[];
  topByProduct: VarianceRow[];
  periodLabel: string;
};

type Tab = "category" | "supplier" | "product";

const TAB_LABELS: Record<Tab, string> = {
  category: "Categoria",
  supplier: "Fornitore",
  product: "Prodotto",
};

const TAB_KEYS: Tab[] = ["category", "supplier", "product"];

function VarianceRowBar({
  row,
  maxDeltaAbs,
  index,
}: {
  row: VarianceRow;
  maxDeltaAbs: number;
  index: number;
}) {
  const isIncrease = row.delta > 0;
  const target = Math.min(100, (Math.abs(row.delta) / maxDeltaAbs) * 100);
  const barColor = isIncrease ? "bg-accent-red" : "bg-accent-green";
  const textColor = isIncrease ? "text-accent-red" : "text-accent-green";

  const [w, setW] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setW(target), 40 + index * 35);
    return () => window.clearTimeout(id);
  }, [target, index]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] text-text-primary">{row.name}</span>
        <div className="flex shrink-0 items-baseline gap-2">
          <span className={`font-mono text-[13px] tabular-nums ${textColor}`}>
            {isIncrease ? "+" : "−"}
            {formatCurrency(Math.abs(row.delta))}
          </span>
          {row.deltaPct !== null && (
            <span className={`font-mono text-[10px] tabular-nums ${textColor}`}>
              ({isIncrease ? "+" : ""}
              {row.deltaPct.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${barColor}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] tabular-nums text-text-tertiary">
        {formatCurrency(row.previous)} → {formatCurrency(row.current)}
      </p>
    </div>
  );
}

export function VarianceCard({
  delta,
  deltaPct,
  topByCategory,
  topBySupplier,
  topByProduct,
  periodLabel,
}: Props) {
  const [tab, setTab] = useState<Tab>("category");

  const rows =
    tab === "category"
      ? topByCategory
      : tab === "supplier"
      ? topBySupplier
      : topByProduct;
  const hasData = rows.length > 0 && rows.some((r) => r.delta !== 0);

  const increase = delta > 0;
  const deltaAbs = Math.abs(delta);
  const noComparison = deltaPct === null && delta === 0;
  const deltaColor = increase ? "text-accent-red" : "text-accent-green";
  const maxDeltaAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.delta)), 0) || 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Top: delta value */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Δ vs periodo precedente
          </p>
          {noComparison ? (
            <p className="mt-1 font-mono text-sm text-text-tertiary">
              Nessun dato periodo precedente
            </p>
          ) : (
            <div className="mt-1 flex items-baseline gap-2">
              {increase ? (
                <TrendingUp className={`h-4 w-4 ${deltaColor}`} />
              ) : (
                <TrendingDown className={`h-4 w-4 ${deltaColor}`} />
              )}
              <span
                className={`font-mono tabular-nums ${deltaColor}`}
                style={{
                  fontSize: "var(--text-display-lg)",
                  lineHeight: "var(--text-display-lg--line-height)",
                  letterSpacing: "var(--text-display-lg--letter-spacing)",
                  fontWeight: 400,
                }}
              >
                {increase ? "+" : "−"}
                {formatCurrency(deltaAbs)}
              </span>
              {deltaPct !== null && (
                <span className={`font-mono text-xs tabular-nums ${deltaColor}`}>
                  ({increase ? "+" : ""}
                  {deltaPct.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            {increase ? "Spesa in aumento" : "Risparmio in corso"}
            <span className="mx-1.5 text-border-subtle">·</span>
            {periodLabel}
          </p>
        </div>

        {/* Segmented tabs — terminal tight */}
        <div
          role="tablist"
          aria-label="Raggruppa per"
          className="inline-flex items-center rounded-lg border border-border-subtle bg-surface-card p-0.5"
        >
          {TAB_KEYS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === tab}
              onClick={() => setTab(t)}
              className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                t === tab
                  ? "bg-accent-green text-surface-base"
                  : "text-text-tertiary hover:text-text-primary hover:bg-surface-hover"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: driver list */}
      <div className="border-t border-border-subtle pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          Top driver · {TAB_LABELS[tab]}
        </p>
        {!hasData ? (
          <div className="flex h-24 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            Nessun cambiamento significativo
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {rows.map((row, i) => (
              <VarianceRowBar
                key={row.name}
                row={row}
                maxDeltaAbs={maxDeltaAbs}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
