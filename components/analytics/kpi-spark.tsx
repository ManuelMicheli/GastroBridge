"use client";

import { CountUp, type CountFormat } from "@/components/fernly/count-up";
import { Sparkline } from "@/components/fernly/sparkline";
import { riseStyle } from "@/components/fernly/primitives";

function delta(current: number, previous: number): { pct: number | null; up: boolean } {
  if (previous === 0) return { pct: current === 0 ? 0 : null, up: current >= 0 };
  const d = ((current - previous) / previous) * 100;
  return { pct: d, up: d >= 0 };
}

/** Analytics KPI card: big counted value, delta vs previous period, sparkline. */
export function KpiSpark({
  title,
  value,
  format,
  previous,
  spark,
  periodLabel,
  index,
  lowerIsBetter = false,
}: {
  title: string;
  value: number;
  format: CountFormat;
  previous: number;
  spark: number[];
  periodLabel: string;
  index: number;
  lowerIsBetter?: boolean;
}) {
  const d = delta(value, previous);
  const good = d.pct === null || d.pct === 0 ? null : lowerIsBetter ? !d.up : d.up;
  return (
    <section className="f-card f-rise flex min-w-0 flex-col overflow-hidden" style={riseStyle(index)} aria-label={title}>
      <div className="px-5 pt-[18px]">
        <h3 className="text-[14px] font-medium text-[var(--f-ink-2)]">{title}</h3>
        <div className="mt-2 text-[34px] font-medium leading-none tracking-[-0.035em] text-[var(--f-ink)] tabular-nums">
          <CountUp value={value} format={format} />
        </div>
        <p className="mt-2 flex items-center gap-1 text-[12px] text-[var(--f-muted)]">
          {d.pct === null ? (
            <span>nuovo rispetto al periodo precedente</span>
          ) : (
            <>
              <span
                className="inline-flex items-center gap-0.5 font-semibold tabular-nums"
                style={{ color: good === null ? "var(--f-muted)" : good ? "var(--f-success)" : "var(--f-danger)" }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className={d.up ? "" : "rotate-180"}>
                  <path d="M4 1.5 7 6H1z" fill="currentColor" />
                </svg>
                {Math.abs(d.pct).toFixed(1).replace(".", ",")}%
              </span>
              <span>vs {periodLabel}</span>
            </>
          )}
        </p>
      </div>
      <div className="mt-3">
        <Sparkline values={spark} height={44} />
      </div>
    </section>
  );
}
