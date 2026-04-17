// app/(app)/cerca/_components/facet-range.tsx
"use client";

import { useId } from "react";

/** Dual-handle range slider built from two native inputs stacked (no libs). */
export function PriceRange({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number] | null;
  onChange: (next: [number, number] | null) => void;
}) {
  const id = useId();
  const lo = value?.[0] ?? min;
  const hi = value?.[1] ?? max;

  const span = Math.max(max - min, 0.01);
  const leftPct = ((lo - min) / span) * 100;
  const rightPct = ((hi - min) / span) * 100;

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-text-secondary">
        <span>€ {lo.toFixed(2)}</span>
        <span>€ {hi.toFixed(2)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-surface-hover">
        <div
          className="absolute top-0 h-full rounded-full bg-accent-green/50"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          id={`${id}-lo`}
          type="range"
          min={min}
          max={max}
          step={0.05}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            onChange([v, hi]);
          }}
          className="absolute inset-0 h-full w-full appearance-none bg-transparent"
        />
        <input
          id={`${id}-hi`}
          type="range"
          min={min}
          max={max}
          step={0.05}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            onChange([lo, v]);
          }}
          className="absolute inset-0 h-full w-full appearance-none bg-transparent"
        />
      </div>
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="mt-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
        >
          reset
        </button>
      )}
    </div>
  );
}

export function ScoreSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-text-secondary">
        <span>score ≥ {value}</span>
        {value > 0 && (
          <button
            onClick={() => onChange(0)}
            className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
          >
            reset
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full appearance-none rounded-full bg-surface-hover accent-[var(--color-accent-green)]"
      />
    </div>
  );
}
