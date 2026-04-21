"use client";

import { useMemo } from "react";

type Point = { business_day: string; food_cost_pct: number | null };

export function FoodCostChart({ data }: { data: Point[] }) {
  const width = 640;
  const height = 180;
  const padding = { top: 16, right: 16, bottom: 24, left: 36 };

  const { path, marks, targetY, lastValue } = useMemo(() => {
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const values = data.map((d) => d.food_cost_pct ?? 0);
    const max = Math.max(50, ...values);
    const min = 0;
    const xAt = (i: number) =>
      data.length <= 1 ? padding.left : padding.left + (i / (data.length - 1)) * innerW;
    const yAt = (v: number) =>
      padding.top + innerH - ((v - min) / (max - min)) * innerH;
    let d = "";
    data.forEach((p, i) => {
      const x = xAt(i);
      const y = yAt(p.food_cost_pct ?? 0);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
    });
    const marks = data.map((p, i) => ({
      x: xAt(i),
      y: yAt(p.food_cost_pct ?? 0),
      v: p.food_cost_pct,
      day: p.business_day,
    }));
    const targetY = yAt(32); // industry target ~32%
    const lastValue = data[data.length - 1]?.food_cost_pct ?? null;
    return { path: d.trim(), marks, targetY, lastValue };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="text-xs text-text-tertiary italic text-center py-6">
        Nessun dato food cost per il periodo
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto overflow-visible"
      role="img"
      aria-label="Food cost percentuale giornaliero"
    >
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={targetY}
        y2={targetY}
        stroke="currentColor"
        strokeDasharray="3 4"
        className="text-text-tertiary/40"
      />
      <text
        x={width - padding.right}
        y={targetY - 4}
        textAnchor="end"
        className="fill-text-tertiary text-[10px] font-mono"
      >
        target 32%
      </text>
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={
          (lastValue ?? 0) > 35 ? "text-accent-orange" : "text-accent-green"
        }
      />
      {marks.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r={2}
          className="fill-text-secondary"
        >
          <title>{`${m.day}: ${m.v === null ? "—" : `${m.v.toFixed(1)}%`}`}</title>
        </circle>
      ))}
    </svg>
  );
}
