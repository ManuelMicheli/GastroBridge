"use client";

import { formatCurrency } from "@/lib/utils/formatters";
import type { WeekdayCell } from "@/lib/analytics/restaurant";

type Props = {
  cells: WeekdayCell[];
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function WeekdayHeatmap({ cells }: Props) {
  const max = cells.reduce((m, c) => Math.max(m, c.totalSpend), 0) || 1;
  const hasAny = cells.some((c) => c.totalSpend > 0);

  if (!hasAny) {
    return (
      <div className="flex h-24 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun ordine nel periodo
      </div>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {cells.map((c, i) => {
        const intensity = c.totalSpend / max;
        const bg = `color-mix(in srgb, var(--color-accent-green) ${
          Math.round(intensity * 75) + 8
        }%, transparent)`;
        return (
          <div
            key={c.weekday}
            className="flex flex-col items-center text-center animate-[fadeInUp_260ms_ease-out_both]"
            style={{ animationDelay: `${i * 35}ms` }}
          >
            <div
              className="flex w-full min-h-[76px] flex-col items-center justify-center rounded-lg border border-border-subtle px-2 py-2.5 transition-colors hover:border-border-accent"
              style={{ backgroundColor: bg }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary">
                {WEEKDAY_LABELS[c.weekday]}
              </span>
              <span className="mt-1 font-mono text-[13px] tabular-nums text-text-primary">
                {formatCurrency(c.totalSpend)}
              </span>
              <span className="mt-0.5 font-mono text-[10px] tabular-nums text-text-tertiary">
                {c.orderCount} ord.
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
