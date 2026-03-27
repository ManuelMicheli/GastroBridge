"use client";

import { useId, useState } from "react";
import { motion } from "motion/react";
import { formatCurrency } from "@/lib/utils/formatters";

type DataPoint = {
  label: string;
  value: number;
};

type Props = {
  data: DataPoint[];
  height?: number;
  color?: string;
  valuePrefix?: string;
};

export function AreaChart({
  data,
  height = 200,
  color = "var(--color-accent-green)",
  valuePrefix = "€",
}: Props) {
  const id = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-text-tertiary text-sm"
        style={{ height }}
      >
        Dati insufficienti
      </div>
    );
  }

  const width = 100; // SVG viewBox percentage-based
  const paddingTop = 10;
  const paddingBottom = 24;
  const paddingX = 4;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.05;
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: paddingX + (i / (data.length - 1)) * (width - paddingX * 2),
    y: paddingTop + (1 - (d.value - min) / range) * chartH,
  }));

  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");
  const lastPt = points[points.length - 1]!;
  const firstPt = points[0]!;
  const areaPath = `${linePath} L ${lastPt.x},${paddingTop + chartH} L ${firstPt.x},${paddingTop + chartH} Z`;

  // Grid lines (3 lines)
  const gridLines = [0, 0.5, 1].map((ratio) => ({
    y: paddingTop + (1 - ratio) * chartH,
    value: min + ratio * range,
  }));

  // Show ~5 X-axis labels evenly
  const xLabelStep = Math.max(1, Math.floor(data.length / 5));

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={paddingX}
              y1={g.y}
              x2={width - paddingX}
              y2={g.y}
              stroke="var(--color-border-subtle)"
              strokeWidth={0.3}
            />
            <text
              x={paddingX}
              y={g.y - 2}
              fill="var(--color-text-tertiary)"
              fontSize={3.2}
              fontFamily="var(--font-mono)"
            >
              {valuePrefix}{Math.round(g.value).toLocaleString("it-IT")}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${id}-fill)`} />

        {/* Line */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={0.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % xLabelStep === 0 && points[i] ? (
            <text
              key={i}
              x={points[i]!.x}
              y={height - 4}
              textAnchor="middle"
              fill="var(--color-text-tertiary)"
              fontSize={3}
              fontFamily="var(--font-mono)"
            >
              {d.label}
            </text>
          ) : null
        )}

        {/* Hover zones */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - (width / data.length) / 2}
            y={paddingTop}
            width={width / data.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            className="cursor-crosshair"
          />
        ))}

        {/* Hover indicator */}
        {hoverIdx !== null && points[hoverIdx] && (
          <>
            <line
              x1={points[hoverIdx].x}
              y1={paddingTop}
              x2={points[hoverIdx].x}
              y2={paddingTop + chartH}
              stroke="var(--color-border-default)"
              strokeWidth={0.3}
              strokeDasharray="1 1"
            />
            <circle
              cx={points[hoverIdx].x}
              cy={points[hoverIdx].y}
              r={1.5}
              fill={color}
              stroke="var(--color-surface-card)"
              strokeWidth={0.5}
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && data[hoverIdx] && points[hoverIdx] && (
        <div
          className="absolute pointer-events-none bg-surface-elevated border border-border-default rounded-lg px-2.5 py-1.5 shadow-elevated-dark z-10"
          style={{
            left: `${(points[hoverIdx]!.x / width) * 100}%`,
            top: `${(points[hoverIdx]!.y / height) * 100 - 12}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-[10px] text-text-tertiary">{data[hoverIdx]!.label}</p>
          <p className="text-xs font-mono font-bold text-text-primary">
            {formatCurrency(data[hoverIdx]!.value)}
          </p>
        </div>
      )}
    </div>
  );
}
