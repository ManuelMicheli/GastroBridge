"use client";

import { useEffect, useRef } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline as FSparkline } from "@/components/fernly/sparkline";

type Props = {
  label: string;
  value: string;
  numericValue?: number;
  previousValue?: number;
  sparklineData?: number[];
  /** When the metric is a cost, a positive delta is bad (warning color). */
  positiveIsGood?: boolean;
  hint?: string;
  /** Optional "01" index prefix, rendered left of the label in mono. */
  index?: string;
};

const EURO_CURRENCY_RE = /^(€|-€|\+€|−€)/;

function formatCountUp(sample: string, n: number): string {
  // Preserve currency prefix / percentage suffix / plain number formatting.
  const isPct = sample.trim().endsWith("%");
  const hasEuro = EURO_CURRENCY_RE.test(sample.trim());
  if (isPct) return `${n.toFixed(1)}%`;
  const pretty = Math.round(n).toLocaleString("it-IT");
  return hasEuro ? `€${pretty}` : pretty;
}

export function TerminalKPICard({
  label,
  value,
  numericValue,
  previousValue,
  sparklineData,
  positiveIsGood = true,
  hint,
  index,
}: Props) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (numericValue === undefined || !valueRef.current) return;
    const el = valueRef.current;
    const end = numericValue;
    const start = 0;
    const duration = 1100;
    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = formatCountUp(value, start + (end - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else el.textContent = value; // snap to final formatted value
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numericValue, value]);

  const trend =
    previousValue !== undefined &&
    previousValue > 0 &&
    numericValue !== undefined
      ? ((numericValue - previousValue) / previousValue) * 100
      : null;

  const positive = trend !== null ? trend >= 0 : true;
  const isGood = trend !== null ? (positiveIsGood ? positive : !positive) : true;
  const deltaColor = isGood ? "var(--f-success)" : "var(--f-danger)";
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;

  // Fernly KPI card: title, counted value, delta line, full-bleed sparkline.
  return (
    <div className="f-card f-rise group relative flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-1.5 px-5 pt-[18px] pb-3">
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--f-ink-2)]">
          {index ? <span className="text-[var(--f-faint)] tabular-nums">{index}</span> : null}
          <span className="truncate">{label}</span>
        </span>

        <span
          ref={valueRef}
          className="text-[30px] font-medium leading-none tracking-[-0.035em] text-[var(--f-ink)] tabular-nums"
        >
          {value}
        </span>

        <div className="min-h-[18px] text-[12px]">
          {trend !== null ? (
            <span className="inline-flex items-center gap-1 tabular-nums text-[var(--f-muted)]">
              <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: deltaColor }}>
                <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
                {positive ? "+" : ""}
                {trend.toFixed(1).replace(".", ",")}%
              </span>
              vs periodo prec.
            </span>
          ) : hint ? (
            <span className="text-[12px] text-[var(--f-muted)]">{hint}</span>
          ) : null}
        </div>
      </div>

      {sparklineData && sparklineData.length > 1 ? (
        <div className="mt-auto">
          <FSparkline values={sparklineData} height={40} />
        </div>
      ) : null}
    </div>
  );
}
