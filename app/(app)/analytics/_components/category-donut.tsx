"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";
import { MACRO_CATEGORY_COLORS } from "@/lib/analytics/category-colors";
import type { CategoryBreakdownRow } from "@/lib/analytics/restaurant";

type Props = {
  data: CategoryBreakdownRow[];
};

type TooltipPayload = {
  payload: CategoryBreakdownRow;
};

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2 shadow-elevated-dark">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        {row.label}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-text-primary">
        {formatCurrency(row.amount)}
      </p>
      <p className="mt-0.5 font-mono text-[10px] tabular-nums text-text-secondary">
        {row.percent.toFixed(1)}% del totale
      </p>
    </div>
  );
}

export function CategoryDonut({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessuna categoria rilevata
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-5">
      <div className="h-52 md:col-span-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius="58%"
              outerRadius="92%"
              paddingAngle={1}
              stroke="var(--color-surface-card)"
              strokeWidth={2}
              isAnimationActive
            >
              {data.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={MACRO_CATEGORY_COLORS[entry.category]}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto pr-1 md:col-span-2">
        {data.map((row) => (
          <li
            key={row.category}
            className="flex items-center gap-2 text-[13px]"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: MACRO_CATEGORY_COLORS[row.category] }}
            />
            <span className="flex-1 truncate text-text-secondary">
              {row.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-text-primary">
              {formatCurrency(row.amount)}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-text-tertiary">
              {row.percent.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
