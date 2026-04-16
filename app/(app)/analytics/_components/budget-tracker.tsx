"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Target, TrendingUp, TrendingDown, AlertTriangle, Settings2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { BudgetState } from "@/lib/analytics/restaurant";

type Props = {
  budget: BudgetState;
};

export function BudgetTracker({ budget }: Props) {
  if (budget.amount === null) {
    return (
      <div className="bg-surface-card border border-dashed border-border-default rounded-2xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-green/10">
            <Target className="h-6 w-6 text-accent-green" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">Imposta un budget mensile</h3>
            <p className="text-sm text-text-tertiary mt-0.5">
              Definisci quanto puoi spendere e tieni sotto controllo i rincari in tempo reale.
            </p>
          </div>
        </div>
        <Link
          href="/impostazioni/budget"
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-green text-surface-base text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Settings2 className="h-4 w-4" />
          Imposta budget
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

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-6 shadow-card-dark">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent-green/10">
            <Target className="h-5 w-5 text-accent-green" />
          </div>
          <div>
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Budget mensile
            </h3>
            <p className="text-2xl font-mono font-bold text-text-primary">
              {formatCurrency(budget.spent)}{" "}
              <span className="text-base font-normal text-text-tertiary">
                / {formatCurrency(budget.amount)}
              </span>
            </p>
          </div>
        </div>
        <Link
          href="/impostazioni/budget"
          className="text-xs text-text-tertiary hover:text-text-primary inline-flex items-center gap-1"
        >
          <Settings2 className="h-3.5 w-3.5" /> Modifica
        </Link>
      </div>

      <div className="mb-3">
        <div className="h-3 bg-surface-elevated rounded-full overflow-hidden relative">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${pctClamped}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-xs">
          <span className={`font-mono font-bold ${overBudget ? "text-accent-red" : warning ? "text-accent-orange" : "text-accent-green"}`}>
            {pct.toFixed(1)}% utilizzato
          </span>
          <span className="text-text-tertiary">
            Giorno {budget.daysElapsed} di {budget.daysInMonth}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border-subtle">
        <div>
          <p className="text-xs text-text-tertiary mb-1">Proiezione fine mese</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-bold text-text-primary">
              {formatCurrency(budget.projected)}
            </span>
            {projectedOver ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-red">
                <TrendingUp className="h-3.5 w-3.5" />
                +{formatCurrency(budget.projected - budget.amount)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-green">
                <TrendingDown className="h-3.5 w-3.5" />
                {formatCurrency(budget.amount - budget.projected)} residuo
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-text-tertiary mb-1">Media giornaliera attuale</p>
          <p className="text-lg font-mono font-bold text-text-primary">
            {formatCurrency(budget.daysElapsed > 0 ? budget.spent / budget.daysElapsed : 0)}
          </p>
        </div>
      </div>

      {overBudget && (
        <div className="mt-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-accent-red shrink-0 mt-0.5" />
          <p className="text-xs text-text-primary">
            Hai superato il budget mensile di{" "}
            <strong className="font-mono">{formatCurrency(budget.spent - budget.amount)}</strong>.
          </p>
        </div>
      )}
      {!overBudget && projectedOver && (
        <div className="mt-4 p-3 rounded-lg bg-accent-orange/10 border border-accent-orange/30 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-accent-orange shrink-0 mt-0.5" />
          <p className="text-xs text-text-primary">
            Al ritmo attuale supererai il budget di{" "}
            <strong className="font-mono">{formatCurrency(budget.projected - budget.amount)}</strong>{" "}
            a fine mese.
          </p>
        </div>
      )}
    </div>
  );
}
