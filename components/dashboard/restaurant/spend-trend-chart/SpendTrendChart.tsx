"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SpendTrendChartProps, SpendTrendPeriod, SpendTrendPoint, SpendTrendStats } from "./types";
import {
  computeStats,
  computeXTicks,
  computeYAxis,
  formatDateFull,
  formatDateShort,
  formatEUR,
  formatEURCompact,
  formatInteger,
  formatTimeCET,
  previousSlice,
  sliceForPeriod,
} from "./utils";

const PERIODS: SpendTrendPeriod[] = ["7D", "30D", "90D", "YTD"];
const PERIOD_LABEL: Record<SpendTrendPeriod, string> = {
  "7D": "Ultimi 7 giorni",
  "30D": "Ultimi 30 giorni",
  "90D": "Ultimi 90 giorni",
  "YTD": "Anno in corso",
};
const PERIOD_SHORT: Record<SpendTrendPeriod, string> = {
  "7D": "7 giorni",
  "30D": "30 giorni",
  "90D": "90 giorni",
  "YTD": "Anno",
};

const CHART_HEIGHT = 240;
const X_AXIS_HEIGHT = 26;
const Y_AXIS_WIDTH = 56;
const PLOT_HEIGHT = CHART_HEIGHT - X_AXIS_HEIGHT;

// Reference: barPercentage 0.7 × categoryPercentage 0.9 = 0.63 slot
const BAR_RATIO = 0.63;

export function SpendTrendChart({
  points,
  transactionsByDate,
  initialPeriod = "30D",
  className,
}: SpendTrendChartProps) {
  const [period, setPeriod] = useState<SpendTrendPeriod>(initialPeriod);
  const reduce = useReducedMotion();
  const reduceMotion = Boolean(reduce);

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });

  const [nowISO, setNowISO] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNowISO(new Date().toISOString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const current = useMemo(() => sliceForPeriod(points, period), [points, period]);
  const previous = useMemo(() => previousSlice(points, period), [points, period]);
  const stats = useMemo(
    () => computeStats(current, previous, transactionsByDate),
    [current, previous, transactionsByDate],
  );

  return (
    <motion.section
      ref={ref}
      role="region"
      aria-label={`Andamento spesa — ${period}`}
      className={[
        "overflow-hidden rounded-2xl border",
        className ?? "",
      ].join(" ")}
      style={{
        background: "var(--color-surface-card)",
        borderColor: "var(--color-border-subtle)",
        boxShadow: "var(--shadow-card-dark)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <TickerBar period={period} onChange={setPeriod} />
      <Hero stats={stats} period={period} inView={inView} reduceMotion={reduceMotion} />
      <AnimatePresence mode="wait">
        <ChartArea
          key={period}
          points={current}
          reduceMotion={reduceMotion}
          inView={inView}
        />
      </AnimatePresence>
      <Footer stats={stats} nowISO={nowISO} />
    </motion.section>
  );
}

/* ──────────────────────── Ticker Bar ──────────────────────── */

function TickerBar({
  period,
  onChange,
}: {
  period: SpendTrendPeriod;
  onChange: (p: SpendTrendPeriod) => void;
}) {
  return (
    <div
      className="flex items-center justify-between border-b px-6 py-3"
      style={{
        background: "var(--color-surface-hover)",
        borderColor: "var(--color-border-subtle)",
      }}
    >
      <div
        className="flex items-center gap-3 text-[12px]"
        style={{ letterSpacing: "0.02em" }}
      >
        <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Spesa</span>
        <span aria-hidden style={{ color: "var(--color-border-default)" }}>·</span>
        <span style={{ color: "var(--color-text-tertiary)" }}>{PERIOD_LABEL[period]}</span>
      </div>

      {/* Desktop toggle */}
      <div className="relative hidden items-center gap-1 sm:flex">
        {PERIODS.map((p) => {
          const active = p === period;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-pressed={active}
              className="relative z-10 rounded-md px-3 py-1.5 text-[12px] font-medium outline-none transition-colors duration-150"
              style={{
                color: active
                  ? "var(--color-surface-card)"
                  : "var(--color-text-tertiary)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 2px var(--color-brand-primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "";
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = "var(--color-text-tertiary)";
              }}
            >
              {active && (
                <motion.span
                  layoutId="period-active"
                  className="absolute inset-0 -z-10 rounded-md"
                  style={{ background: "var(--color-text-primary)" }}
                  transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                />
              )}
              {PERIOD_SHORT[p]}
            </button>
          );
        })}
      </div>

      {/* Mobile select */}
      <select
        aria-label="Periodo"
        className="rounded-md border bg-transparent px-2 py-1.5 text-[12px] font-medium sm:hidden min-h-[36px]"
        value={period}
        onChange={(e) => onChange(e.target.value as SpendTrendPeriod)}
        style={{
          borderColor: "var(--color-border-subtle)",
          color: "var(--color-text-primary)",
        }}
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>{PERIOD_SHORT[p]}</option>
        ))}
      </select>
    </div>
  );
}

/* ──────────────────────── Hero ──────────────────────── */

function useCountUp(target: number, enabled: boolean, duration = 900) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const prevTargetRef = useRef(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      prevTargetRef.current = target;
      return;
    }
    const from = prevTargetRef.current;
    const to = target;
    if (Math.abs(to - from) < 0.01) {
      setValue(to);
      prevTargetRef.current = to;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(from + (to - from) * ease(t));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevTargetRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      prevTargetRef.current = to;
    };
  }, [target, enabled, duration]);
  return value;
}

function Hero({
  stats,
  period,
  inView,
  reduceMotion,
}: {
  stats: SpendTrendStats;
  period: SpendTrendPeriod;
  inView: boolean;
  reduceMotion: boolean;
}) {
  const animatedTotal = useCountUp(stats.total, inView && !reduceMotion);
  const animatedAvg = useCountUp(stats.average, inView && !reduceMotion);
  const animatedPeak = useCountUp(stats.peak.value, inView && !reduceMotion);
  const animatedLow = useCountUp(stats.low, inView && !reduceMotion);
  const animatedDeltaAbs = useCountUp(Math.abs(stats.deltaAbsolute), inView && !reduceMotion);
  const animatedDeltaPct = useCountUp(Math.abs(stats.deltaPercent), inView && !reduceMotion);
  const deltaPositive = stats.deltaAbsolute >= 0;
  const fullDeltaAvailable = stats.hasCurrentData && stats.hasPreviousData;
  const deltaColor = deltaPositive
    ? "var(--color-success)"
    : "var(--color-error)";

  return (
    <div className="flex flex-col items-start justify-between gap-6 px-8 pb-5 pt-7 md:flex-row md:items-end md:gap-8">
      {/* Left */}
      <div className="flex-1 min-w-0">
        <p
          className="mb-2"
          style={{
            fontSize: "12px",
            color: "var(--color-text-tertiary)",
          }}
        >
          Spesa totale · {PERIOD_LABEL[period]}
        </p>
        <div className="flex items-baseline gap-1 flex-wrap">
          <span
            style={{
              fontSize: "24px",
              fontWeight: 500,
              color: "var(--color-text-secondary)",
              lineHeight: 1.05,
            }}
          >
            €
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "var(--text-display-xl, 38px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "var(--color-text-primary)",
            }}
          >
            {formatEUR(animatedTotal)}
          </span>
        </div>
        {!stats.hasCurrentData ? (
          <p
            className="mt-2"
            style={{ fontSize: "13px", color: "var(--color-text-tertiary)" }}
          >
            Nessun ordine in questo periodo
          </p>
        ) : fullDeltaAvailable ? (
          <p
            className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5"
            style={{ fontSize: "13px" }}
          >
            <span style={{ color: deltaColor, fontWeight: 600 }}>
              {deltaPositive ? "▲" : "▼"} {deltaPositive ? "+" : "−"}{formatEUR(animatedDeltaAbs)}
            </span>
            <span style={{ color: deltaColor, fontWeight: 500 }}>
              ({deltaPositive ? "+" : "−"}{animatedDeltaPct.toFixed(1).replace(".", ",")}%)
            </span>
            <span style={{ color: "var(--color-text-tertiary)" }}>
              rispetto al periodo precedente
            </span>
          </p>
        ) : (
          <p
            className="mt-2"
            style={{ fontSize: "13px", color: "var(--color-text-tertiary)" }}
          >
            Primo periodo di storico disponibile
          </p>
        )}
      </div>

      {/* Right — secondary KPI */}
      <div
        className="flex flex-wrap gap-x-8 gap-y-4 md:border-l md:pl-8"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <KpiBlock
          label="Media giornaliera"
          value={stats.hasCurrentData ? `€ ${formatEUR(animatedAvg)}` : "—"}
          delay={0.4}
          inView={inView}
          reduceMotion={reduceMotion}
        />
        <KpiBlock
          label="Giorno più alto"
          value={stats.hasCurrentData ? `€ ${formatEUR(animatedPeak)}` : "—"}
          delay={0.5}
          inView={inView}
          reduceMotion={reduceMotion}
        />
        <KpiBlock
          label="Giorno più basso"
          value={stats.low > 0 ? `€ ${formatEUR(animatedLow)}` : "—"}
          delay={0.6}
          inView={inView}
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
}

function KpiBlock({
  label,
  value,
  delay,
  inView,
  reduceMotion,
}: {
  label: string;
  value: string;
  delay: number;
  inView: boolean;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <p
        className="mb-1"
        style={{
          fontSize: "11px",
          color: "var(--color-text-tertiary)",
        }}
      >
        {label}
      </p>
      <p
        className="font-mono"
        style={{
          fontSize: "16px",
          fontWeight: 500,
          lineHeight: 1.1,
          color: "var(--color-text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </p>
    </motion.div>
  );
}

/* ──────────────────────── Chart Area ──────────────────────── */

function ChartArea({
  points,
  reduceMotion,
  inView,
}: {
  points: SpendTrendPoint[];
  reduceMotion: boolean;
  inView: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const n = Math.max(1, points.length);
  const values = points.map((p) => p.value);
  const maxVal = values.length > 0 ? Math.max(...values) : 0;
  const yAxis = computeYAxis(maxVal);
  const peakIdx = points.length > 0
    ? values.reduce((bi, v, i) => (v > (values[bi] ?? -Infinity) ? i : bi), 0)
    : -1;
  const peakValue = peakIdx >= 0 ? values[peakIdx] ?? 0 : 0;

  const xTickIdx = computeXTicks(points.length, 8);
  const isEmpty = maxVal === 0;

  // viewBox in plot area only (no axis padding — labels live in HTML overlay)
  const VB_W = 1000;
  const VB_H = PLOT_HEIGHT; // matches rendered height 1:1 vertically
  const slot = VB_W / n;
  const barW = slot * BAR_RATIO;

  // Adaptive stagger keeps total cascade <= 600ms regardless of bar count.
  const staggerUnit = Math.min(0.02, 0.6 / Math.max(1, n));

  return (
    <motion.div
      className="relative w-full px-6 pb-2"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        {/* Y axis labels column */}
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{ width: Y_AXIS_WIDTH, height: PLOT_HEIGHT }}
        >
          {yAxis.ticks.map((v, i) => {
            const topPct = (1 - v / yAxis.max) * 100;
            return (
              <span
                key={`y-${i}`}
                className="absolute right-2 font-mono whitespace-nowrap"
                style={{
                  top: `${topPct}%`,
                  transform: "translateY(-50%)",
                  fontSize: "9px",
                  color: "var(--color-text-tertiary)",
                  letterSpacing: "0.02em",
                }}
              >
                {formatEURCompact(v)}
              </span>
            );
          })}
        </div>

        {/* Plot area (SVG + tooltip overlay) */}
        <div
          className="absolute right-0 top-0"
          style={{ left: Y_AXIS_WIDTH, height: PLOT_HEIGHT }}
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            role="img"
            className="block h-full w-full overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <title>Andamento spesa giornaliera</title>
            <desc>
              Grafico a barre con spesa in EUR per ciascun giorno del periodo selezionato.
            </desc>

            {/* Grid lines */}
            {yAxis.ticks.map((v, i) => {
              const y = (1 - v / yAxis.max) * VB_H;
              return (
                <line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={VB_W}
                  y2={y}
                  strokeWidth={0.5}
                  stroke="var(--color-border-subtle)"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Baseline (bottom) */}
            <line
              x1={0}
              y1={VB_H}
              x2={VB_W}
              y2={VB_H}
              strokeWidth={1}
              stroke="var(--color-border-default)"
              vectorEffect="non-scaling-stroke"
            />

            {/* Bars */}
            {points.map((p, i) => {
              const x = i * slot + (slot - barW) / 2;
              const barH = p.value === 0
                ? 2
                : Math.max(2, (p.value / yAxis.max) * VB_H);
              const y = VB_H - barH;
              const isPeak = i === peakIdx && p.value > 0 && peakValue > 0;
              const isZero = p.value === 0;
              const isHovered = hoverIdx === i;
              const fill = isZero
                ? "var(--color-border-subtle)"
                : isPeak || isHovered
                  ? "var(--color-brand-primary)"
                  : "color-mix(in srgb, var(--color-brand-primary) 55%, transparent)";
              const dimmed = hoverIdx !== null && !isHovered ? 0.32 : 1;
              return (
                <motion.rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={0}
                  ry={0}
                  fill={fill}
                  pointerEvents="none"
                  style={{
                    transformOrigin: `${x + barW / 2}px ${VB_H}px`,
                    opacity: dimmed,
                    transition: "opacity 180ms ease-out, fill 180ms ease-out",
                  }}
                  initial={reduceMotion ? false : { scaleY: 0 }}
                  animate={inView ? { scaleY: 1 } : { scaleY: reduceMotion ? 1 : 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.4, delay: i * staggerUnit, ease: [0.22, 1, 0.36, 1] }
                  }
                />
              );
            })}

            {/* Crosshair vertical line */}
            {hoverIdx !== null && points[hoverIdx] && !isEmpty && (
              <line
                x1={hoverIdx * slot + slot / 2}
                x2={hoverIdx * slot + slot / 2}
                y1={0}
                y2={VB_H}
                stroke="var(--color-border-default)"
                strokeWidth={0.5}
                strokeDasharray="2 3"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                style={{ opacity: 0.6 }}
              />
            )}

            {/* Hover zones (transparent, column-wide) */}
            {!isEmpty && points.map((_, i) => {
              const zoneX = i * slot;
              return (
                <rect
                  key={`zone-${i}`}
                  x={zoneX}
                  y={0}
                  width={slot}
                  height={VB_H}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onFocus={() => setHoverIdx(i)}
                  onBlur={() => setHoverIdx(null)}
                  className="cursor-crosshair"
                />
              );
            })}
          </svg>

          {/* Empty state */}
          {isEmpty && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{
                fontSize: "13px",
                color: "var(--color-text-tertiary)",
              }}
            >
              Nessun ordine in questo periodo
            </div>
          )}

          {/* Tooltip */}
          <AnimatePresence>
            {hoverIdx !== null && points[hoverIdx] && !isEmpty && (
              <Tooltip
                point={points[hoverIdx]!}
                leftPct={((hoverIdx * slot + slot / 2) / VB_W) * 100}
                topPx={(1 - points[hoverIdx]!.value / yAxis.max) * VB_H}
              />
            )}
          </AnimatePresence>
        </div>

        {/* X axis labels row */}
        <div
          className="absolute right-0 bottom-0"
          style={{ left: Y_AXIS_WIDTH, height: X_AXIS_HEIGHT }}
        >
          {(() => {
            const hoveredPoint = hoverIdx !== null ? points[hoverIdx] : null;
            const indicesToShow = hoveredPoint
              ? Array.from(new Set([...xTickIdx, hoverIdx!])).sort((a, b) => a - b)
              : xTickIdx;
            return indicesToShow.map((idx) => {
              const p = points[idx];
              if (!p) return null;
              const leftPct = ((idx * slot + slot / 2) / VB_W) * 100;
              const isFirst = idx === 0;
              const isLast = idx === points.length - 1;
              const translateX = isFirst ? "0%" : isLast ? "-100%" : "-50%";
              const isHovered = hoverIdx === idx;
              return (
                <span
                  key={`x-${idx}`}
                  className="absolute font-mono whitespace-nowrap"
                  style={{
                    left: `${leftPct}%`,
                    top: 8,
                    transform: `translateX(${translateX})`,
                    fontSize: "10px",
                    color: isHovered
                      ? "var(--color-text-primary)"
                      : "var(--color-text-tertiary)",
                    fontWeight: isHovered ? 500 : 400,
                    letterSpacing: "0.02em",
                    transition: "color 150ms ease-out, font-weight 150ms ease-out",
                  }}
                >
                  {formatDateShort(p.date)}
                </span>
              );
            });
          })()}
        </div>
      </div>
    </motion.div>
  );
}

function Tooltip({
  point,
  leftPct,
  topPx,
}: {
  point: SpendTrendPoint;
  leftPct: number;
  topPx: number;
}) {
  return (
    <motion.div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-[3px] px-3 py-2"
      style={{
        left: `${leftPct}%`,
        top: topPx,
        transform: "translate(-50%, calc(-100% - 10px))",
        minWidth: 128,
        background: "var(--color-text-primary)",
        color: "var(--color-surface-card)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.12)",
        transition: "left 160ms cubic-bezier(0.22, 1, 0.36, 1), top 160ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <p
        className="mb-1"
        style={{
          fontSize: "11px",
          fontWeight: 500,
          opacity: 0.65,
        }}
      >
        {formatDateFull(point.date)}
      </p>
      <p className="font-mono" style={{ fontSize: "14px", fontWeight: 600 }}>
        € {formatEUR(point.value)}
      </p>
      {/* Arrow */}
      <span
        aria-hidden
        className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid var(--color-text-primary)",
        }}
      />
    </motion.div>
  );
}

/* ──────────────────────── Footer ──────────────────────── */

function Footer({ stats, nowISO }: { stats: SpendTrendStats; nowISO: string | null }) {
  const volPerDay = stats.totalDays > 0 ? stats.total / stats.totalDays : 0;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-t px-6 pb-4 pt-3.5"
      style={{ borderColor: "var(--color-border-subtle)" }}
    >
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1"
        style={{
          fontSize: "12px",
          color: "var(--color-text-tertiary)",
        }}
      >
        <span>
          <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
            {formatInteger(stats.transactionsCount)}
          </span>{" "}
          ordini
        </span>
        <span>
          <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
            {formatInteger(stats.activeDays)}/{formatInteger(stats.totalDays)}
          </span>{" "}
          giorni con ordini
        </span>
        <span>
          media{" "}
          <span style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}>
            € {formatEUR(volPerDay)}
          </span>{" "}
          al giorno
        </span>
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--color-text-tertiary)",
        }}
      >
        Aggiornato alle {nowISO ? formatTimeCET(nowISO) : "—"}
      </div>
    </div>
  );
}
