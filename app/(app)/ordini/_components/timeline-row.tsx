// app/(app)/ordini/_components/timeline-row.tsx
"use client";

import { forwardRef } from "react";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import { formatCurrency } from "@/lib/utils/formatters";
import { statusColorClass } from "../_lib/bucketize";
import type { OrderFeedRow, TimeBucket } from "../_lib/types";

function formatTimestamp(iso: string, bucket: TimeBucket): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (bucket === "today" || bucket === "yesterday") {
    // HH:mm
    return new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  if (bucket === "this_week") {
    // "lun 11:30"
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  // earlier: full date
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export const TimelineRow = forwardRef<
  HTMLButtonElement,
  {
    row: OrderFeedRow;
    bucket: TimeBucket;
    selected: boolean;
    onSelect: (id: string) => void;
    rowId: string;
  }
>(function TimelineRow({ row, bucket, selected, onSelect, rowId }, ref) {
  const statusLabel = ORDER_STATUS_LABELS[row.status] ?? row.status;
  const dot = statusColorClass(row.status);
  const ts = formatTimestamp(row.createdAt, bucket);
  const shortId = row.id.slice(0, 8).toUpperCase();

  return (
    <button
      ref={ref}
      id={rowId}
      type="button"
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      data-selected={selected ? "true" : "false"}
      className={`group grid w-full grid-cols-[64px_14px_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-l-2 px-3 text-left transition-colors ${
        selected
          ? "border-accent-green bg-accent-green/5"
          : "border-transparent hover:border-accent-green hover:bg-surface-hover"
      }`}
      style={{ minHeight: 40 }}
    >
      {/* timestamp */}
      <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
        {ts}
      </span>

      {/* status dot */}
      <span
        className={`h-2 w-2 rounded-full ${dot}`}
        aria-hidden
        title={statusLabel}
      />

      {/* id + supplier */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-[12px] text-text-primary">
          #{shortId}
        </span>
        <span className="truncate text-[13px] text-text-secondary">
          {row.supplierName ?? "—"}
          {row.supplierCount > 1 && (
            <span className="ml-1 font-mono text-[10px] text-text-tertiary">
              +{row.supplierCount - 1}
            </span>
          )}
        </span>
      </span>

      {/* total */}
      <span className="font-mono text-[13px] tabular-nums text-text-primary">
        {formatCurrency(row.total)}
      </span>

      {/* status label (desktop only) */}
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary md:inline">
        {statusLabel}
      </span>
    </button>
  );
});
