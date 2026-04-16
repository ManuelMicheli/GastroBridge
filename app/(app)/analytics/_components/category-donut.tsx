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

function DonutTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="bg-surface-elevated border border-border-default rounded-lg px-3 py-2 shadow-elevated-dark">
      <p className="text-xs text-text-tertiary mb-1">{row.label}</p>
      <p className="text-sm font-mono font-bold text-text-primary">{formatCurrency(row.amount)}</p>
      <p className="text-xs text-text-secondary mt-0.5">{row.percent.toFixed(1)}% del totale</p>
    </div>
  );
}

export function CategoryDonut({ data }: Props) {
  const hasData = data.length > 0;

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
      <h3 className="font-semibold text-text-primary mb-1">Spesa per categoria</h3>
      <p className="text-xs text-text-tertiary mb-4">
        Categoria merceologica inferita dal nome prodotto
      </p>
      {!hasData ? (
        <div className="h-64 flex items-center justify-center text-sm text-text-tertiary">
          Nessuna categoria rilevata nel periodo
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div className="md:col-span-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={1}
                  stroke="var(--color-surface-card)"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.category} fill={MACRO_CATEGORY_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="md:col-span-2 space-y-2 max-h-56 overflow-y-auto pr-1">
            {data.map((row) => (
              <div key={row.category} className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: MACRO_CATEGORY_COLORS[row.category] }}
                />
                <span className="flex-1 text-text-secondary truncate">{row.label}</span>
                <span className="font-mono font-bold text-text-primary shrink-0">
                  {formatCurrency(row.amount)}
                </span>
                <span className="text-xs text-text-tertiary shrink-0 w-10 text-right">
                  {row.percent.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
