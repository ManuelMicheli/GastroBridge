"use client";

import { useMemo } from "react";
import type { ActivityDay } from "@/lib/analytics/restaurant";
import { useWeekStartsOn } from "@/components/fernly/appearance-provider";

const LEVELS = ["var(--f-fill-2)", "var(--acc-200)", "var(--acc-400)", "var(--acc-600)", "var(--acc-900)"];

function level(n: number, max: number): number {
  if (n <= 0) return 0;
  if (max <= 1) return 4;
  const r = n / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

/**
 * Contribution-style heatmap of orders per day over the last 20 weeks
 * (columns = weeks, rows = weekdays in the configured week start).
 */
export function ActivityHeatmap({ days }: { days: ActivityDay[] }) {
  const weekStartsOn = useWeekStartsOn();
  const { weeks, max, total } = useMemo(() => {
    const max = days.reduce((m, d) => Math.max(m, d.orders), 0);
    const total = days.reduce((s, d) => s + d.orders, 0);
    if (days.length === 0) return { weeks: [] as (ActivityDay | null)[][], max, total };
    const first = new Date(`${days[0]!.date}T12:00:00`);
    const lead = (first.getDay() - weekStartsOn + 7) % 7;
    const cells: (ActivityDay | null)[] = [...Array.from({ length: lead }, () => null), ...days];
    const weeks: (ActivityDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks, max, total };
  }, [days, weekStartsOn]);

  const fmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short" });

  return (
    <div>
      <div className="f-scroll overflow-x-auto pb-1">
        <div className="flex gap-[5px]" role="img" aria-label={`${total} ordini nelle ultime 20 settimane`}>
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[5px]">
              {Array.from({ length: 7 }, (_, di) => {
                const d = w[di];
                if (!d) return <span key={di} className="h-[18px] w-[18px]" />;
                return (
                  <span
                    key={di}
                    className="f-fade h-[18px] w-[18px] rounded-[5px]"
                    style={{ background: LEVELS[level(d.orders, max)], ["--i" as string]: wi * 0.35 }}
                    title={`${fmt.format(new Date(`${d.date}T12:00:00`))}: ${d.orders} ordin${d.orders === 1 ? "e" : "i"}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--f-muted)]">
        <span className="tabular-nums">{total} ordini in 20 settimane</span>
        <span className="flex items-center gap-1.5">
          Meno
          {LEVELS.map((c) => (
            <span key={c} aria-hidden className="h-3 w-3 rounded-[4px]" style={{ background: c }} />
          ))}
          Più
        </span>
      </div>
    </div>
  );
}
