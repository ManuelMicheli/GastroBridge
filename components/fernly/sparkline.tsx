"use client";

import { useId, useMemo } from "react";

/**
 * Full-bleed area sparkline (Fernly analytics KPI cards): 1.75px accent line
 * over a soft vertical gradient. Pure SVG — no chart library. The line draws
 * in from the left on mount (CSS dash animation, disabled for reduced motion).
 */
export function Sparkline({
  values,
  height = 46,
  color = "var(--acc-600)",
  className,
}: {
  values: number[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const w = 200;
  const { line, area } = useMemo(() => {
    const pts = values.length >= 2 ? values : [0, ...(values.length ? values : [0])];
    const max = Math.max(...pts);
    const min = Math.min(...pts);
    const span = max - min || 1;
    const pad = 4;
    const xy = pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return [x, y] as const;
    });
    // Smooth with a light Catmull-Rom → Bezier conversion.
    let d = `M ${xy[0]![0].toFixed(2)} ${xy[0]![1].toFixed(2)}`;
    for (let i = 0; i < xy.length - 1; i++) {
      const p0 = xy[Math.max(0, i - 1)]!;
      const p1 = xy[i]!;
      const p2 = xy[i + 1]!;
      const p3 = xy[Math.min(xy.length - 1, i + 2)]!;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return { line: d, area: `${d} L ${w} ${height} L 0 ${height} Z` };
  }, [values, height]);

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height, display: "block" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${uid})`} className="f-fade" style={{ ["--d" as string]: "250ms" }} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="f-draw"
      />
    </svg>
  );
}
