"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Target, TrendingUp, TrendingDown, AlertTriangle, Settings2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { BudgetState } from "@/lib/analytics/restaurant";

type Props = {
  budget: BudgetState;
};

export function BudgetTracker({ budget }: Props) {
  if (budget.amount === null) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border-default bg-surface-elevated/40 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-green/10">
            <Target className="h-4 w-4 text-accent-green" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              Imposta un budget mensile
            </p>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Definisci il tetto di spesa e monitora in tempo reale i rincari.
            </p>
          </div>
        </div>
        <Link
          href="/impostazioni/budget"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent-green px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-surface-base transition-opacity hover:opacity-90"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Imposta
        </Link>
      </div>
    );
  }

  const pct = budget.percentUsed ?? 0;
  const pctClamped = Math.min(pct, 100);
  const overBudget = pct > 100;
  const warning = pct >= 80 && pct <= 100;
  const projectedOver = budget.projected > budget.amount;

  const barColor = overBudget
    ? "bg-accent-red"
    : warning
    ? "bg-accent-orange"
    : "bg-accent-green";
  const pctColor = overBudget
    ? "text-accent-red"
    : warning
    ? "text-accent-orange"
    : "text-accent-green";

  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setAnimPct(pctClamped), 40);
    return () => window.clearTimeout(id);
  }, [pctClamped]);

  const avgDaily = budget.daysElapsed > 0 ? budget.spent / budget.daysElapsed : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: big number + edit link */}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span
            className="font-mono tabular-nums text-text-primary"
            style={{
              fontSize: "var(--text-display-lg)",
              lineHeight: "var(--text-display-lg--line-height)",
              letterSpacing: "var(--text-display-lg--letter-spacing)",
              fontWeight: 400,
            }}
          >
            {formatCurrency(budget.spent)}
          </span>
          <span className="ml-2 font-mono text-sm tabular-nums text-text-tertiary">
            / {formatCurrency(budget.amount)}
          </span>
        </div>
        <Link
          href="/impostazioni/budget"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary transition-colors hover:text-text-primary"
        >
          <Settings2 className="h-3 w-3" />
          Modifica
        </Link>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${barColor}`}
            style={{ width: `${animPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
          <span className={`tabular-nums ${pctColor}`}>
            {pct.toFixed(1)}% utilizzato
          </span>
          <span className="tabular-nums text-text-tertiary">
            Giorno {budget.daysElapsed}/{budget.daysInMonth}
          </span>
        </div>
      </div>

      {/* Bottom stats row — hairline divider */}
      <div className="grid grid-cols-2 gap-6 border-t border-border-subtle pt-4">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Proiezione
          </span>
          <span className="font-mono text-[15px] tabular-nums text-text-primary">
            {formatCurrency(budget.projected)}
          </span>
          {projectedOver ? (
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-accent-red">
              <TrendingUp className="h-3 w-3" />
              +{formatCurrency(budget.projected - budget.amount)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums text-accent-green">
              <TrendingDown className="h-3 w-3" />
              {formatCurrency(budget.amount - budget.projected)} residuo
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Media/giorno
          </span>
          <span className="font-mono text-[15px] tabular-nums text-text-primary">
            {formatCurrency(avgDaily)}
          </span>
          <span className="font-mono text-[10px] text-text-tertiary">
            nel periodo
          </span>
        </div>
      </div>

      {/* Alert strip */}
      {overBudget && (
        <div className="flex items-start gap-2 rounded-md border border-accent-red/30 bg-accent-red/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-red" />
          <p className="font-mono text-[11px] tabular-nums text-text-primary">
            Budget superato di{" "}
            <strong>{formatCurrency(budget.spent - budget.amount)}</strong>.
          </p>
        </div>
      )}
      {!overBudget && projectedOver && (
        <div className="flex items-start gap-2 rounded-md border border-accent-orange/30 bg-accent-orange/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-orange" />
          <p className="font-mono text-[11px] tabular-nums text-text-primary">
            Al ritmo attuale supererai il budget di{" "}
            <strong>{formatCurrency(budget.projected - budget.amount)}</strong> a
            fine mese.
          </p>
        </div>
      )}
    </div>
  );
}
