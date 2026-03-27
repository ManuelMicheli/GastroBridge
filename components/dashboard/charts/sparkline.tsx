"use client";

import { useId } from "react";
import { motion } from "motion/react";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
};

export function Sparkline({
  data,
  width = 80,
  height = 32,
  color = "var(--color-accent-green)",
  filled = true,
}: Props) {
  const id = useId();

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((value, i) => ({
    x: padding + (i / (data.length - 1)) * (width - padding * 2),
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
  }));

  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(" ");

  const lastP = points[points.length - 1]!;
  const firstP = points[0]!;
  const areaPath = filled
    ? `${linePath} L ${lastP.x},${height} L ${firstP.x},${height} Z`
    : "";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {filled && (
        <>
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.20" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${id}-fill)`} />
        </>
      )}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
      />
    </svg>
  );
}
