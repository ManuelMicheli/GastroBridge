"use client";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

function YoyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-border-default rounded-lg px-3 py-2 shadow-elevated-dark">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-text-secondary">
            {p.dataKey === "current" ? "Corrente" : "Anno prec."}
          </span>
          <span className="font-mono font-bold text-text-primary">
            {p.value !== null && p.value !== undefined ? formatCurrency(p.value) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function YoyTrendChart({ data }: Props) {
  const hasAnyData = data.some((d) => d.current > 0 || (d.previous ?? 0) > 0);
  const hasPrevious = data.some((d) => d.previous !== null && d.previous > 0);

  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-card-dark">
      <div className="flex items-start justify-between mb-4 gap-2">
        <div>
          <h3 className="font-semibold text-text-primary">Trend 12 mesi</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {hasPrevious
              ? "Con confronto anno precedente (YoY)"
              : "Il confronto YoY appare quando esistono dati dell'anno precedente"}
          </p>
        </div>
      </div>
      {!hasAnyData ? (
        <div className="h-64 flex items-center justify-center text-sm text-text-tertiary">
          Nessun dato nei 12 mesi
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-tertiary)", fontSize: 11 }}
                axisLine={{ stroke: "var(--color-border-subtle)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--color-text-tertiary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${Math.round(v).toLocaleString("it-IT")}`}
                width={70}
              />
              <Tooltip content={<YoyTooltip />} />
              {hasPrevious && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
              {hasPrevious && (
                <Line
                  type="monotone"
                  dataKey="previous"
                  name="Anno precedente"
                  stroke="#8A8A9A"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive
                  connectNulls
                />
              )}
              <Line
                type="monotone"
                dataKey="current"
                name="Corrente"
                stroke="#2DD47A"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#2DD47A", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
