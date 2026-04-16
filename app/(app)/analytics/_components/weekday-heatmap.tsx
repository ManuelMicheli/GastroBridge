"use client";

import { motion } from "motion/react";
import { formatCurrency } from "@/lib/utils/formatters";
import type { WeekdayCell } from "@/lib/analytics/restaurant";

type Props = {
  cells: WeekdayCell[];
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function WeekdayHeatmap({ cells }: Props) {
  const max = cells.reduce((m, c) => Math.max(m, c.totalSpend), 0) || 1;
  const hasAny = cells.some((c) => c.totalSpend > 0);

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
      <h3 className="font-semibold text-text-primary mb-1">Pattern giorni della settimana</h3>
      <p className="text-xs text-text-tertiary mb-4">
        Quando ordini più frequentemente — luminosità proporzionale alla spesa
      </p>
      {!hasAny ? (
        <div className="h-32 flex items-center justify-center text-sm text-text-tertiary">
          Nessun ordine nel periodo
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {cells.map((c, i) => {
            const intensity = c.totalSpend / max;
            const bg = `color-mix(in srgb, var(--color-accent-green) ${Math.round(intensity * 85) + 10}%, transparent)`;
            return (
              <motion.div
                key={c.weekday}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="w-full rounded-lg border border-border-subtle p-3 flex flex-col items-center justify-center min-h-[72px]"
                  style={{ backgroundColor: bg }}
                >
                  <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    {WEEKDAY_LABELS[c.weekday]}
                  </span>
                  <span className="text-sm font-mono font-bold text-text-primary mt-1">
                    {formatCurrency(c.totalSpend)}
                  </span>
                  <span className="text-[10px] text-text-tertiary mt-0.5">
                    {c.orderCount} ord.
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
