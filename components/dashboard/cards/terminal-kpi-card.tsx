"use client";

import { useEffect, useRef } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "../charts/sparkline";

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
  const deltaColor = isGood
    ? "var(--color-success)"
    : "var(--color-text-warning)";
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card px-4 pt-3.5 pb-3 transition-colors hover:border-border-accent"
      style={{
        // Subtle dotted watermark grid, awwwards-grade restraint.
        backgroundImage:
          "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-text-tertiary) 14%, transparent) 1px, transparent 0)",
        backgroundSize: "14px 14px",
        backgroundPosition: "0 0",
      }}
    >
      {/* Corner brackets — top-right & bottom-left. Slight reveal on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-t border-r border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-border-subtle opacity-60 transition-[opacity,border-color] duration-200 group-hover:border-accent-green group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-primary">
            {index ? (
              <span className="text-text-tertiary/70 tabular-nums">{index}</span>
            ) : null}
            {index ? (
              <span aria-hidden className="text-border-subtle">
                ·
              </span>
            ) : null}
            <span className="truncate">{label}</span>
            {trend !== null ? (
              <span
                aria-hidden
                className="relative ml-0.5 inline-flex h-1.5 w-1.5 items-center justify-center"
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: deltaColor,
                    opacity: 0.35,
                    animation: "kpiPulse 2.4s ease-in-out infinite",
                  }}
                />
                <span
                  className="relative h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: deltaColor }}
                />
              </span>
            ) : null}
          </span>

          <span
            ref={valueRef}
            className="font-mono tabular-nums text-text-primary"
            style={{
              fontSize: "var(--text-display-lg, 28px)",
              lineHeight: "var(--text-display-lg--line-height, 32px)",
              letterSpacing: "var(--text-display-lg--letter-spacing, -0.011em)",
              fontWeight: 500,
            }}
          >
            {value}
          </span>

          <div className="min-h-[18px] text-[11px]">
            {trend !== null ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono tabular-nums"
                style={{
                  color: deltaColor,
                  backgroundColor: `color-mix(in srgb, ${deltaColor} 10%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${deltaColor} 22%, transparent)`,
                }}
              >
                <DeltaIcon className="h-3 w-3" aria-hidden />
                {positive ? "+" : ""}
                {trend.toFixed(1)}%
                <span className="ml-0.5 font-normal text-text-tertiary">
                  vs prec.
                </span>
              </span>
            ) : hint ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                {hint}
              </span>
            ) : null}
          </div>
        </div>

        {sparklineData && sparklineData.length > 1 ? (
          <div className="relative shrink-0 pt-1 opacity-80 transition-opacity duration-200 group-hover:opacity-100">
            {/* Baseline rule under sparkline */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-[3px] h-px bg-border-subtle"
            />
            <Sparkline
              data={sparklineData}
              width={72}
              height={34}
              color="var(--color-accent-green)"
            />
          </div>
        ) : null}
      </div>

      {/* Scan line — runs along the bottom on hover, pure awwwards detail. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-accent-green to-transparent transition-transform duration-500 ease-out group-hover:scale-x-100"
      />

      <style jsx>{`
        @keyframes kpiPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.35;
          }
          50% {
            transform: scale(2.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
