"use client";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";
import type { YoyPoint } from "@/lib/analytics/restaurant";

type Props = {
  data: YoyPoint[];
};

type TooltipPayload = {
  payload: YoyPoint;
  value: number;
  dataKey: string;
  color: string;
};

function YoyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2 shadow-elevated-dark">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        {label}
      </p>
      <div className="mt-1 flex flex-col gap-0.5">
        {payload.map((p) => (
          <div
            key={p.dataKey}
            className="flex items-center gap-2 font-mono text-[11px] tabular-nums"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-text-secondary">
              {p.dataKey === "current" ? "Corrente" : "Anno prec."}
            </span>
            <span className="text-text-primary">
              {p.value !== null && p.value !== undefined
                ? formatCurrency(p.value)
                : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function YoyTrendChart({ data }: Props) {
  const hasAnyData = data.some((d) => d.current > 0 || (d.previous ?? 0) > 0);
  const hasPrevious = data.some((d) => d.previous !== null && d.previous > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Custom compact legend — matches terminal style */}
      <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: "var(--color-accent-green)" }}
          />
          Corrente
        </span>
        {hasPrevious && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-0.5 w-4 rounded-full"
              style={{
                background:
                  "repeating-linear-gradient(to right, #8A8A9A 0 3px, transparent 3px 6px)",
              }}
            />
            Anno prec.
          </span>
        )}
        {!hasPrevious && hasAnyData && (
          <span className="text-text-tertiary/70">
            confronto YoY non disponibile
          </span>
        )}
      </div>

      {!hasAnyData ? (
        <div className="flex h-56 items-center justify-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          Nessun dato nei 12 mesi
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="var(--color-border-subtle)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fill: "var(--color-text-tertiary)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
                axisLine={{ stroke: "var(--color-border-subtle)" }}
                tickLine={false}
              />
              <YAxis
                tick={{
                  fill: "var(--color-text-tertiary)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${Math.round(v).toLocaleString("it-IT")}`}
                width={64}
              />
              <Tooltip content={<YoyTooltip />} cursor={{ stroke: "var(--color-border-default)" }} />
              {hasPrevious && (
                <Line
                  type="monotone"
                  dataKey="previous"
                  name="Anno precedente"
                  stroke="#8A8A9A"
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                  dot={false}
                  isAnimationActive
                  connectNulls
                />
              )}
              <Line
                type="monotone"
                dataKey="current"
                name="Corrente"
                stroke="var(--color-accent-green)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "var(--color-accent-green)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
