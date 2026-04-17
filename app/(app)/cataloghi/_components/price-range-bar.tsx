// app/(app)/cataloghi/_components/price-range-bar.tsx
"use client";

import { formatCurrency } from "@/lib/utils/formatters";
import { priceDotPosition } from "../_lib/aggregates";

type Props = {
  min: number;
  max: number;
  /** Optional marker (e.g. median) rendered on the line as a small tick. */
  marker?: number | null;
};

/**
 * A horizontal min-max visualization: two anchored dots with a hairline
 * between them, with EUR labels outside. Marker (if provided) renders as a
 * subtle tick inside the range.
 */
export function PriceRangeBar({ min, max, marker }: Props) {
  const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
  const markerPos =
    marker !== null && marker !== undefined && hasRange
      ? priceDotPosition(marker, min, max)
      : null;

  return (
    <div className="w-full select-none">
      <div className="relative h-3">
        {/* Hairline */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border-subtle"
        />
        {/* Start dot */}
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-secondary"
        />
        {/* End dot */}
        <span
          aria-hidden
          className="absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-green"
        />
        {/* Marker */}
        {markerPos !== null && (
          <span
            aria-hidden
            className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-text-tertiary/60"
            style={{ left: `${markerPos * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] tabular-nums text-text-secondary">
        <span>{formatCurrency(min)}</span>
        <span className="text-text-tertiary">
          {hasRange ? `Δ ${formatCurrency(max - min)}` : "—"}
        </span>
        <span>{formatCurrency(max)}</span>
      </div>
    </div>
  );
}
