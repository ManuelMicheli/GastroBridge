"use client";

import { useMemo, useState, useId } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { DarkCard } from "../cards/dark-card";
import { formatCurrency } from "@/lib/utils/formatters";

type Point = { label: string; value: number };
type Period = "7d" | "30d" | "90d";

type Props = {
  data: Point[];                  // expected: 90 days of data, sliced per period
  brandColor?: string;            // override brand line/fill color
  onPeriodChange?: (p: Period) => void;
};

const Y_AXIS_W = 56;
const X_AXIS_H = 28;

/** Catmull-Rom → cubic bezier path. Buttery smooth curves. */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0]!.x},${points[0]!.y} L ${points[1]!.x},${points[1]!.y}`;
  }
  const tension = 0.85;
  const segs: string[] = [`M ${points[0]!.x},${points[0]!.y}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? points[i + 1]!;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;
    segs.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return segs.join(" ");
}

export function SpendingTrendCard({
  data: rawData,
  brandColor = "var(--color-brand-primary)",
  onPeriodChange,
}: Props) {
  const id = useId();
  const [period, setPeriod] = useState<Period>("30d");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    const slice = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return rawData.slice(-slice);
  }, [rawData, period]);

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    onPeriodChange?.(p);
  };

  const stats = useMemo(() => {
    if (data.length === 0) return { total: 0, avg: 0, peak: 0, peakLabel: "—", deltaPct: 0 };
    const total = data.reduce((s, d) => s + d.value, 0);
    const avg = total / data.length;
    const peakIdx = data.reduce((bi, d, i) => (d.value > data[bi]!.value ? i : bi), 0);
    const peak = data[peakIdx]!.value;
    const peakLabel = data[peakIdx]!.label;
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half).reduce((s, d) => s + d.value, 0);
    const secondHalf = data.slice(half).reduce((s, d) => s + d.value, 0);
    const deltaPct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
    return { total, avg, peak, peakLabel, deltaPct };
  }, [data]);

  const chartHeight = 240;
  const plotHeight = chartHeight - X_AXIS_H;

  if (data.length < 2) {
    return (
      <DarkCard noPadding>
        <CardChrome
          period={period}
          onPeriod={handlePeriod}
          stats={stats}
        />
        <div className="flex items-center justify-center text-text-tertiary text-sm" style={{ height: chartHeight }}>
          Dati insufficienti per il periodo selezionato
        </div>
      </DarkCard>
    );
  }

  // SVG plot dimensions (viewBox-relative, stretched horizontally).
  const w = 100;
  const padTop = 8;
  const padX = 1.5;
  const chartH = plotHeight - padTop - 4;

  const values = data.map((d) => d.value);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const min = minRaw === maxRaw ? minRaw * 0.9 : minRaw - (maxRaw - minRaw) * 0.1;
  const max = minRaw === maxRaw ? maxRaw * 1.1 || 1 : maxRaw + (maxRaw - minRaw) * 0.05;
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * (w - padX * 2),
    y: padTop + (1 - (d.value - min) / range) * chartH,
  }));

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1]!.x},${padTop + chartH} L ${points[0]!.x},${padTop + chartH} Z`;

  const grid = [0, 0.5, 1].map((r) => ({
    y: padTop + (1 - r) * chartH,
    yPct: ((padTop + (1 - r) * chartH) / plotHeight) * 100,
    value: min + r * range,
  }));

  const xLabelStep = Math.max(1, Math.floor(data.length / 5));

  return (
    <DarkCard noPadding>
      <CardChrome period={period} onPeriod={handlePeriod} stats={stats} />

      <div className="relative w-full" style={{ height: chartHeight }}>
        {/* Y-axis labels column */}
        <div
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: Y_AXIS_W, height: plotHeight }}
        >
          {grid.map((g, i) => (
            <span
              key={`y-${i}`}
              className="absolute right-3 font-mono text-[10px] text-text-tertiary whitespace-nowrap leading-none"
              style={{ top: `${g.yPct}%`, transform: "translateY(-50%)" }}
            >
              {formatCurrency(Math.round(g.value))}
            </span>
          ))}
        </div>

        {/* Plot SVG */}
        <div className="absolute top-0" style={{ left: Y_AXIS_W, right: 8, height: plotHeight }}>
          <svg
            viewBox={`0 0 ${w} ${plotHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={brandColor} stopOpacity="0.32" />
                <stop offset="60%" stopColor={brandColor} stopOpacity="0.06" />
                <stop offset="100%" stopColor={brandColor} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${id}-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={brandColor} stopOpacity="0.7" />
                <stop offset="50%" stopColor={brandColor} stopOpacity="1" />
                <stop offset="100%" stopColor={brandColor} stopOpacity="0.85" />
              </linearGradient>
              <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="0.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid */}
            {grid.map((g, i) => (
              <line
                key={i}
                x1={0}
                y1={g.y}
                x2={w}
                y2={g.y}
                stroke="var(--color-border-subtle)"
                strokeWidth={0.2}
                strokeDasharray={i === 0 || i === grid.length - 1 ? "none" : "0.6 0.6"}
              />
            ))}

            {/* Area fill (animates in) */}
            <motion.path
              d={areaPath}
              fill={`url(#${id}-fill)`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            />

            {/* Smooth line — draws left-to-right */}
            <motion.path
              d={linePath}
              fill="none"
              stroke={`url(#${id}-line)`}
              strokeWidth={0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${id}-glow)`}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Hover indicator */}
            {hoverIdx !== null && points[hoverIdx] && (
              <>
                <line
                  x1={points[hoverIdx].x}
                  y1={padTop}
                  x2={points[hoverIdx].x}
                  y2={padTop + chartH}
                  stroke={brandColor}
                  strokeWidth={0.25}
                  strokeDasharray="0.6 0.6"
                  opacity={0.6}
                />
                <circle
                  cx={points[hoverIdx].x}
                  cy={points[hoverIdx].y}
                  r={1.6}
                  fill={brandColor}
                  stroke="var(--color-surface-card)"
                  strokeWidth={0.6}
                />
                <circle
                  cx={points[hoverIdx].x}
                  cy={points[hoverIdx].y}
                  r={0.8}
                  fill="var(--color-surface-card)"
                />
              </>
            )}

            {/* Hover zones */}
            {points.map((p, i) => (
              <rect
                key={i}
                x={p.x - w / data.length / 2}
                y={padTop}
                width={w / data.length}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                className="cursor-crosshair"
              />
            ))}
          </svg>

          {/* Tooltip — HTML overlay */}
          {hoverIdx !== null && data[hoverIdx] && points[hoverIdx] && (
            <div
              className="absolute pointer-events-none rounded-lg px-3 py-2 z-10"
              style={{
                left: `${(points[hoverIdx]!.x / w) * 100}%`,
                top: `${(points[hoverIdx]!.y / plotHeight) * 100}%`,
                transform: "translate(-50%, calc(-100% - 12px))",
                background: "var(--color-surface-elevated)",
                border: `1px solid var(--color-border-default)`,
                boxShadow: "var(--elevation-card-active-hover)",
                minWidth: 96,
              }}
            >
              <p
                className="uppercase mb-0.5"
                style={{
                  fontSize: "10px",
                  letterSpacing: "+0.04em",
                  color: "var(--color-text-tertiary)",
                  fontWeight: 500,
                }}
              >
                {data[hoverIdx]!.label}
              </p>
              <p
                className="font-mono"
                style={{
                  fontSize: "var(--text-title-md)",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {formatCurrency(data[hoverIdx]!.value)}
              </p>
            </div>
          )}
        </div>

        {/* X-axis labels row */}
        <div
          className="absolute bottom-0"
          style={{ left: Y_AXIS_W, right: 8, height: X_AXIS_H }}
        >
          {data.map((d, i) => {
            if (i % xLabelStep !== 0 && i !== data.length - 1) return null;
            const isFirst = i === 0;
            const isLast = i === data.length - 1;
            const leftPct = (i / (data.length - 1)) * 100;
            const transform = isFirst
              ? "translateX(0)"
              : isLast
                ? "translateX(-100%)"
                : "translateX(-50%)";
            return (
              <span
                key={`x-${i}`}
                className="absolute font-mono text-[10px] text-text-tertiary pointer-events-none whitespace-nowrap"
                style={{ left: `${leftPct}%`, top: 6, transform }}
              >
                {d.label}
              </span>
            );
          })}
        </div>
      </div>
    </DarkCard>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function CardChrome({
  period,
  onPeriod,
  stats,
}: {
  period: Period;
  onPeriod: (p: Period) => void;
  stats: { total: number; avg: number; peak: number; peakLabel: string; deltaPct: number };
}) {
  const trendingUp = stats.deltaPct >= 0;
  const TrendIcon = trendingUp ? TrendingUp : TrendingDown;
  const trendColor = trendingUp ? "var(--color-text-warning)" : "var(--color-success)";
  const periodLabel: Record<Period, string> = {
    "7d": "7 GIORNI",
    "30d": "30 GIORNI",
    "90d": "90 GIORNI",
  };

  return (
    <div className="p-5 pb-3">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p
            className="uppercase mb-1.5"
            style={{
              fontSize: "var(--text-caption)",
              letterSpacing: "var(--text-caption--letter-spacing)",
              fontWeight: "var(--text-caption--font-weight)",
              color: "var(--caption-color, var(--color-brand-depth))",
            }}
          >
            {periodLabel[period]}
          </p>
          <h2
            style={{
              fontSize: "var(--text-title-lg)",
              lineHeight: "var(--text-title-lg--line-height)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Andamento spesa
          </h2>
        </div>
        <PeriodToggle period={period} onChange={onPeriod} />
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <Stat label="Totale" value={formatCurrency(stats.total)} primary />
        <Divider />
        <Stat label="Media giornaliera" value={formatCurrency(Math.round(stats.avg))} />
        <Divider />
        <Stat
          label={`Picco · ${stats.peakLabel}`}
          value={formatCurrency(stats.peak)}
          accent
        />
        <div className="ml-auto flex items-center gap-1.5 shrink-0" title="Trend prima vs seconda metà del periodo">
          <TrendIcon className="h-3.5 w-3.5" style={{ color: trendColor }} />
          <span
            className="font-mono"
            style={{ fontSize: "11px", fontWeight: 600, color: trendColor }}
          >
            {trendingUp ? "+" : ""}
            {Math.round(stats.deltaPct)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  primary,
  accent,
}: {
  label: string;
  value: string;
  primary?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className="uppercase mb-1 flex items-center gap-1"
        style={{
          fontSize: "10px",
          letterSpacing: "+0.04em",
          color: "var(--color-text-tertiary)",
          fontWeight: 500,
        }}
      >
        {accent && <Sparkles className="h-3 w-3" style={{ color: "var(--color-brand-primary)" }} />}
        {label}
      </p>
      <p
        className="font-mono"
        style={{
          fontSize: primary ? "var(--text-title-lg)" : "var(--text-body)",
          fontWeight: primary ? 700 : 600,
          color: "var(--color-text-primary)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-[color:var(--color-border-subtle)]" aria-hidden />;
}

function PeriodToggle({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const opts: Period[] = ["7d", "30d", "90d"];
  return (
    <div
      role="tablist"
      aria-label="Periodo"
      className="inline-flex items-center rounded-md p-0.5 border border-[color:var(--color-border-subtle)]"
      style={{ background: "var(--color-surface-card)" }}
    >
      {opts.map((p) => {
        const active = p === period;
        return (
          <button
            key={p}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className="relative px-3 py-1 transition-colors"
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: active
                ? "var(--color-brand-on-primary)"
                : "var(--color-text-secondary)",
              borderRadius: "5px",
              background: active ? "var(--color-brand-primary)" : "transparent",
            }}
          >
            {p.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
