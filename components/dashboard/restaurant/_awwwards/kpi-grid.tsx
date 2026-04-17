// components/dashboard/restaurant/_awwwards/kpi-grid.tsx
//
// Terminal KPI hero: big monthly-spending number on top + 4 sub-stats below.
// Pure presentational — takes already-formatted values + delta objects.

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";

export type Delta = {
  sign: "+" | "-" | "";
  pct: string;
  positive: boolean; // true when current >= previous
};

export type KpiGridProps = {
  spending: number;
  spendingDelta: Delta;
  ordersThisMonth: number;
  ordersDelta: Delta;
  avgOrder: number; // 0 when no orders this month
  prevAvgOrder: number;
  savings: number;
  activeSuppliers: number;
  /**
   * Optional "HH:mm" caption rendered top-right of the hero. When the grid
   * is wrapped in a SectionFrame that already shows AS OF in its header,
   * leave this undefined to avoid duplication.
   */
  asOf?: string;
};

function DeltaChip({
  delta,
  // When true, a positive delta is *good* (e.g. more orders, higher savings).
  // When false, a positive delta is *warning* (e.g. spending more than last month).
  positiveIsGood,
  suffix = "",
}: {
  delta: Delta;
  positiveIsGood: boolean;
  suffix?: string;
}) {
  if (delta.pct === "—") {
    return (
      <span className="font-mono text-[11px] text-text-tertiary">—</span>
    );
  }
  const isGood = positiveIsGood ? delta.positive : !delta.positive;
  const color = isGood ? "var(--color-success)" : "var(--color-text-warning)";
  const Icon = delta.positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[11px]"
      style={{ color }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {delta.pct}
      {suffix ? <span className="ml-1 text-text-tertiary">{suffix}</span> : null}
    </span>
  );
}

function StatCell({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </span>
      <span className="font-mono tabular-nums text-[18px] text-text-primary">
        {value}
      </span>
      <span className="min-h-[14px] text-[11px]">{children}</span>
    </div>
  );
}

export function KpiGrid({
  spending,
  spendingDelta,
  ordersThisMonth,
  ordersDelta,
  avgOrder,
  prevAvgOrder,
  savings,
  activeSuppliers,
  asOf,
}: KpiGridProps) {
  // Build an avg-order delta locally (previous period only if we have data).
  const avgDelta: Delta = (() => {
    if (prevAvgOrder === 0) {
      return { sign: "", pct: avgOrder === 0 ? "—" : "100%", positive: true };
    }
    const d = ((avgOrder - prevAvgOrder) / prevAvgOrder) * 100;
    const positive = d >= 0;
    return {
      sign: positive ? "+" : "",
      pct: `${Math.abs(Math.round(d))}%`,
      positive,
    };
  })();

  return (
    <div className="relative">
      {/* Optional AS OF caption, top-right (skipped when the wrapping frame
          already renders it in its header). */}
      {asOf ? (
        <span className="pointer-events-none absolute right-0 top-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          AS OF {asOf}
        </span>
      ) : null}

      {/* Main number + delta */}
      <div className="flex items-baseline gap-3 flex-wrap pr-20">
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: "var(--text-display-2xl)",
            lineHeight: "var(--text-display-2xl--line-height)",
            letterSpacing: "var(--text-display-2xl--letter-spacing)",
            fontWeight: 400,
            color: "var(--color-text-primary)",
          }}
        >
          {formatCurrency(spending)}
        </span>
        {spendingDelta.pct !== "—" && (
          <span
            className="inline-flex items-center gap-0.5 font-mono tabular-nums"
            style={{
              fontSize: "var(--text-body-sm)",
              fontWeight: 600,
              color: spendingDelta.positive
                ? "var(--color-text-warning)"
                : "var(--color-success)",
            }}
          >
            {spendingDelta.positive ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {spendingDelta.pct}
            <span className="ml-1 text-text-tertiary font-normal">
              vs mese scorso
            </span>
          </span>
        )}
      </div>

      {/* separator rule */}
      <div
        aria-hidden
        className="my-5 h-px w-full bg-border-subtle"
      />

      {/* 4 sub-KPIs: 4 cols ≥640px, 2 cols ≥400px, 1 col below */}
      <div className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2 sm:grid-cols-4 sm:gap-4">
        <StatCell label="Ordini" value={String(ordersThisMonth)}>
          <DeltaChip delta={ordersDelta} positiveIsGood suffix="vs prec." />
        </StatCell>
        <StatCell
          label="Spesa media"
          value={avgOrder > 0 ? formatCurrency(avgOrder) : "—"}
        >
          {prevAvgOrder > 0 ? (
            <DeltaChip delta={avgDelta} positiveIsGood={false} suffix="vs prec." />
          ) : (
            <span className="font-mono text-[11px] text-text-tertiary">
              nessun confronto
            </span>
          )}
        </StatCell>
        <StatCell
          label="Risparmio"
          value={formatCurrency(savings)}
        >
          <span className="font-mono text-[11px] text-text-tertiary">stimato</span>
        </StatCell>
        <StatCell label="Fornitori" value={String(activeSuppliers)}>
          <span className="font-mono text-[11px] text-text-tertiary">attivi</span>
        </StatCell>
      </div>
    </div>
  );
}
