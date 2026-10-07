"use client";

// Revenue line chart of the supplier dashboard (desktop "Andamento fatturato"
// frame). Split out of supplier-dashboard.tsx so recharts is lazy-loaded.

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

type Point = { label: string; value: number };

export function SupplierRevenueChart({
  variant,
  data,
}: {
  /** "rich": 30-day series from the KPI view; "fallback": legacy chartData. */
  variant: "rich" | "fallback";
  data: Point[];
}) {
  if (variant === "rich") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
        >
          <defs>
            <linearGradient
              id="supplierRevenueLine"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor="var(--color-accent-green)"
              />
              <stop
                offset="100%"
                stopColor="var(--color-accent-orange)"
              />
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
              v >= 1000
                ? `€${Math.round(v / 1000)}k`
                : `€${Math.round(v)}`
            }
            width={48}
          />
          <Tooltip
            cursor={{
              stroke: "var(--color-border-default)",
              strokeWidth: 1,
            }}
            contentStyle={{
              backgroundColor: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--color-text-primary)",
            }}
            labelStyle={{
              color: "var(--color-text-tertiary)",
              fontSize: 11,
            }}
            formatter={(value) => [
              formatCurrency(
                typeof value === "number"
                  ? value
                  : Number(value ?? 0),
              ),
              "Fatturato",
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#supplierRevenueLine)"
            strokeWidth={2.2}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--color-accent-green)",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
      >
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
            v >= 1000
              ? `€${Math.round(v / 1000)}k`
              : `€${Math.round(v)}`
          }
          width={48}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-accent-orange)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
