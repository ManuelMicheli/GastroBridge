"use client";

import { useState } from "react";
import { motion } from "motion/react";
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

export function VarianceCard({
  delta,
  deltaPct,
  topByCategory,
  topBySupplier,
  topByProduct,
  periodLabel,
}: Props) {
  const [tab, setTab] = useState<Tab>("category");

  const rows = tab === "category" ? topByCategory : tab === "supplier" ? topBySupplier : topByProduct;
  const hasData = rows.length > 0 && rows.some((r) => r.delta !== 0);

  const increase = delta > 0;
  const deltaAbs = Math.abs(delta);

  const maxDeltaAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.delta)), 0) || 1;

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-card-dark">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
            Varianza vs periodo precedente
          </p>
          {deltaPct === null && delta === 0 ? (
            <p className="text-2xl font-mono font-bold text-text-primary mt-1">
              Nessun dato periodo precedente
            </p>
          ) : (
            <div className="flex items-baseline gap-2 mt-1">
              {increase ? (
                <TrendingUp className="h-5 w-5 text-accent-red" />
              ) : (
                <TrendingDown className="h-5 w-5 text-accent-green" />
              )}
              <p
                className={`text-2xl font-mono font-bold ${
                  increase ? "text-accent-red" : "text-accent-green"
                }`}
              >
                {increase ? "+" : "−"}
                {formatCurrency(deltaAbs)}
              </p>
              {deltaPct !== null && (
                <span className={`text-sm font-medium ${increase ? "text-accent-red" : "text-accent-green"}`}>
                  ({increase ? "+" : ""}
                  {deltaPct.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-text-tertiary mt-1">
            {increase ? "Stai spendendo più che nel periodo precedente" : "Stai risparmiando rispetto al periodo precedente"}
            {" — "}
            <span className="text-text-secondary">{periodLabel}</span>
          </p>
        </div>
        <div className="inline-flex gap-1 p-1 rounded-lg bg-surface-elevated border border-border-subtle">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                t === tab
                  ? "bg-accent-green text-surface-base"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-text-tertiary mb-3">
        Top 6 driver del delta per {TAB_LABELS[tab].toLowerCase()}
      </p>

      {!hasData ? (
        <div className="h-32 flex items-center justify-center text-sm text-text-tertiary">
          Nessun cambiamento significativo per {TAB_LABELS[tab].toLowerCase()}
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, i) => {
            const isIncrease = row.delta > 0;
            const widthPct = Math.min(100, (Math.abs(row.delta) / maxDeltaAbs) * 100);
            const barColor = isIncrease ? "bg-accent-red" : "bg-accent-green";
            return (
              <motion.div
                key={row.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-baseline justify-between mb-1 gap-3">
                  <span className="text-sm font-medium text-text-primary truncate">{row.name}</span>
                  <div className="flex items-baseline gap-2 shrink-0">
                    <span
                      className={`text-sm font-mono font-bold ${
                        isIncrease ? "text-accent-red" : "text-accent-green"
                      }`}
                    >
                      {isIncrease ? "+" : "−"}
                      {formatCurrency(Math.abs(row.delta))}
                    </span>
                    {row.deltaPct !== null && (
                      <span className={`text-xs ${isIncrease ? "text-accent-red" : "text-accent-green"}`}>
                        ({isIncrease ? "+" : ""}
                        {row.deltaPct.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.04 }}
                  />
                </div>
                <p className="text-[10px] text-text-tertiary mt-0.5 font-mono">
                  {formatCurrency(row.previous)} → {formatCurrency(row.current)}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
