"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";
import type { CategoryBreakdownRow } from "@/lib/analytics/restaurant";

type Props = {
  data: CategoryBreakdownRow[];
};

// Fernly donut palette: accent steps first, then two warm/neutral tones —
// slices stay readable whatever accent preset is active.
const SLICE_COLORS = [
  "var(--acc-900)",
  "var(--acc-600)",
  "var(--acc-400)",
  "#E2A21B",
  "#A7AEAB",
  "var(--acc-200)",
  "#6B7270",
];

const eur0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
} as Intl.NumberFormatOptions);

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryBreakdownRow }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-[12px] bg-[var(--acc-950)] px-3 py-2 text-white shadow-[0_10px_28px_rgba(16,24,20,0.25)]">
      <p className="text-[12px] text-white/70">{row.label}</p>
      <p className="text-[14px] font-semibold tabular-nums">{formatCurrency(row.amount)}</p>
      <p className="text-[11.5px] text-white/70 tabular-nums">{row.percent.toFixed(1)}% del totale</p>
    </div>
  );
}

/** "Spesa per categoria" — Fernly donut with gaps, total in the centre. */
export function CategoryDonut({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-[13px] text-[var(--f-muted)]">
        Nessuna categoria rilevata
      </div>
    );
  }

  const total = data.reduce((s, r) => s + r.amount, 0);
  // Collapse the long tail so the legend stays at five rows like the reference.
  const top = data.slice(0, 5);
  const rest = data.slice(5);
  const rows: CategoryBreakdownRow[] =
    rest.length > 0
      ? [
          ...top,
          {
            category: "altro",
            label: `Altre ${rest.length}`,
            amount: rest.reduce((s, r) => s + r.amount, 0),
            percent: rest.reduce((s, r) => s + r.percent, 0),
          },
        ]
      : top;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="amount"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={2.5}
              cornerRadius={2}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              animationDuration={900}
            >
              {rows.map((entry, i) => (
                <Cell key={`${entry.category}-${i}`} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--f-ink)] tabular-nums">
            {eur0.format(total)}
          </span>
          <span className="text-[11.5px] text-[var(--f-muted)]">spesi nel periodo</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {rows.map((row, i) => (
          <li key={`${row.category}-${i}`} className="flex items-center gap-2.5 text-[13px]">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
            <span className="flex-1 truncate text-[var(--f-ink-2)]">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--f-ink)]">{eur0.format(row.amount)}</span>
            <span className="w-10 shrink-0 text-right text-[11.5px] tabular-nums text-[var(--f-muted)]">
              {row.percent.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
