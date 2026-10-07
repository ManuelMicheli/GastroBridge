"use client";

import { useId, type ReactNode } from "react";
import { useCountUp } from "./count-up";

type Segment = {
  /** 0..1 share of the half circle. */
  value: number;
  color?: string;
  hatch?: boolean;
  label: string;
};

/**
 * Semi-circular gauge with thick rounded strokes (spec §4 "Gauge").
 * Segments are laid out left→right; each one tweens its share so the arc
 * sweeps on mount and morphs when the data changes.
 */
export function SemiGauge({
  segments,
  center,
  caption,
  width = 240,
}: {
  segments: Segment[];
  center: ReactNode;
  caption?: ReactNode;
  width?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const r = 84;
  const stroke = 32;
  const cx = 110;
  const cy = 112;
  const total = Math.PI * r;
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Tween each share (×1000 for precision through the integer-friendly hook).
  const s0 = useCountUp((segments[0]?.value ?? 0) * 1000, { duration: 1100, delay: 220 });
  const s1 = useCountUp((segments[1]?.value ?? 0) * 1000, { duration: 1100, delay: 220 });
  const s2 = useCountUp((segments[2]?.value ?? 0) * 1000, { duration: 1100, delay: 220 });
  const shares = [s0, s1, s2].slice(0, segments.length).map((v) => Math.max(0, v / 1000));

  let cursor = 0;
  const drawn = segments.map((seg, i) => {
    const len = (shares[i] ?? 0) * total;
    const start = cursor;
    cursor += len;
    return { seg, len, start };
  });

  return (
    <div className="relative mx-auto" style={{ width, maxWidth: "100%" }}>
      <svg viewBox="0 0 220 128" className="block h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <pattern id={`h-${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" fill="var(--f-fill)" />
            <rect width="1.8" height="7" fill="var(--f-hatch)" />
          </pattern>
        </defs>
        {/* Draw back-to-front so earlier segments' round caps overlap later ones */}
        {[...drawn].reverse().map(({ seg, len, start }, idx) =>
          len <= 0.5 ? null : (
            <path
              key={`${seg.label}-${idx}`}
              d={path}
              fill="none"
              stroke={seg.hatch ? `url(#h-${uid})` : seg.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${len} ${total + 40}`}
              strokeDashoffset={-start}
            />
          ),
        )}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <div className="text-[40px] font-medium leading-none tracking-[-0.04em] text-[var(--f-ink)] tabular-nums">{center}</div>
        {caption ? <div className="mt-1 text-[12px] text-[var(--f-muted)]">{caption}</div> : null}
      </div>
    </div>
  );
}
