"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/analytics/restaurant";

type Row = {
  date: string;
  label: string;
  spend: number;
  prev: number | null;
  avg7: number;
};

const eur0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
} as Intl.NumberFormatOptions);

const dayFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-[12px] bg-[var(--acc-950)] px-3.5 py-2.5 text-white shadow-[0_10px_28px_rgba(16,24,20,0.25)]">
      <p className="text-[12px] text-white/70">{row.label}</p>
      <p className="text-[15px] font-semibold tabular-nums">{eur0.format(row.spend)}</p>
      <p className="mt-0.5 text-[11.5px] text-white/70 tabular-nums">
        media 7 gg {eur0.format(row.avg7)}
        {row.prev !== null ? ` · prec. ${eur0.format(row.prev)}` : ""}
      </p>
    </div>
  );
}

/**
 * "Andamento spesa" area chart: accent line + soft gradient fill for the
 * selected period, dashed grey line for the previous one, dashed vertical
 * guide + ringed dot + dark accent tooltip on hover (spec §4 Analytics).
 * Recharts animates the series when the range changes.
 */
export function ThroughputChart({ data }: { data: DailyPoint[] }) {
  const rows = useMemo<Row[]>(() => {
    return data.map((d, i) => {
      const from = Math.max(0, i - 6);
      const win = data.slice(from, i + 1);
      const avg7 = win.reduce((s, x) => s + x.spend, 0) / win.length;
      return {
        date: d.date,
        label: dayFmt.format(new Date(`${d.date}T12:00:00`)),
        spend: d.spend,
        prev: d.prevSpend,
        avg7,
      };
    });
  }, [data]);

  if (rows.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-[13px] text-[var(--f-muted)]">
        Nessun dato nel periodo
      </div>
    );
  }

  const tickEvery = Math.max(1, Math.ceil(rows.length / 6));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="thr-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--acc-600)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--acc-600)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--f-line)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={tickEvery - 1}
            tick={{ fill: "var(--f-muted)", fontSize: 11.5 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: "var(--f-muted)", fontSize: 11.5 }}
            tickFormatter={(v: number) => (v >= 1000 ? `€${Math.round(v / 100) / 10}k` : `€${Math.round(v)}`)}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--f-ink-2)", strokeWidth: 1, strokeDasharray: "3 4" }}
            offset={14}
          />
          <Line
            type="monotone"
            dataKey="prev"
            stroke="var(--f-faint)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            isAnimationActive
            animationDuration={700}
          />
          <Area
            type="monotone"
            dataKey="spend"
            stroke="var(--acc-600)"
            strokeWidth={2.25}
            fill="url(#thr-fill)"
            dot={false}
            activeDot={{ r: 6, fill: "var(--f-card)", stroke: "var(--acc-700)", strokeWidth: 2.5 }}
            isAnimationActive
            animationDuration={800}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
