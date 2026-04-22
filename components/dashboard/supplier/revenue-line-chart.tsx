"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/formatters";

type Point = { day: string; label: string; value: number };

// Isolated in its own file so the supplier dashboard can dynamic-import
// it and keep recharts (~500KB) off the critical render path.
export default function RevenueLineChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="revenueLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent-green)" />
            <stop offset="100%" stopColor="var(--color-accent-orange)" />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--color-border-subtle)"
          strokeDasharray="2 4"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          stroke="var(--color-text-tertiary)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          stroke="var(--color-text-tertiary)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`
          }
          width={48}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border-default)", strokeWidth: 1 }}
          contentStyle={{
            backgroundColor: "var(--color-surface-elevated)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            fontSize: 12,
            color: "var(--color-text-primary)",
          }}
          labelStyle={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
          formatter={(value) => [
            formatCurrency(typeof value === "number" ? value : Number(value ?? 0)),
            "Fatturato",
          ]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="url(#revenueLine)"
          strokeWidth={2.2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-accent-green)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
