// app/(supplier)/supplier/ordini/_components/timeline-row.tsx
//
// Dense 40px command-timeline row for a supplier split.

"use client";

import { forwardRef } from "react";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "@/components/ui/status-dot";
import { formatCurrency } from "@/lib/utils/formatters";
import { useFlashOnSplitUpdate } from "@/components/supplier/realtime/flash-highlight";
import type { SupplierTimelineRow, TimeBucket } from "../_lib/types";

function formatTimestamp(iso: string, bucket: TimeBucket): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  if (bucket === "today" || bucket === "yesterday") {
    return new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  if (bucket === "this_week") {
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export const SupplierTimelineRowItem = forwardRef<
  HTMLButtonElement,
  {
    row: SupplierTimelineRow;
    bucket: TimeBucket;
    selected: boolean;
    onSelect: (id: string) => void;
    rowId: string;
  }
>(function SupplierTimelineRowItem(
  { row, bucket, selected, onSelect, rowId },
  ref,
) {
  const flash = useFlashOnSplitUpdate(row.splitId);
  const meta = getOrderStatusMeta(row.workflowState);
  const statusLabel = meta.label;
  const ts = formatTimestamp(row.createdAt, bucket);
  const shortId = row.orderNumber ?? `#${row.splitId.slice(0, 8).toUpperCase()}`;

  return (
    <button
      ref={ref}
      id={rowId}
      type="button"
      data-split-id={row.splitId}
      onClick={() => onSelect(row.splitId)}
      aria-pressed={selected}
      data-selected={selected ? "true" : "false"}
      className={`group grid w-full grid-cols-[64px_14px_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-l-2 px-3 text-left transition-colors ${flash} ${
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
      <StatusDot tone={meta.tone} size={8} pulse={meta.pulse} />

      {/* id + restaurant (+ zone) */}
      <span className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-[12px] text-text-primary">
          {shortId}
        </span>
        <span className="truncate text-[13px] text-text-secondary">
          {row.restaurantName}
          {row.zoneName ? (
            <span className="ml-1.5 font-mono text-[10px] text-text-tertiary">
              · {row.zoneName}
            </span>
          ) : null}
        </span>
      </span>

      {/* subtotal */}
      <span className="font-mono text-[13px] tabular-nums text-text-primary">
        {formatCurrency(Number(row.subtotal || 0))}
      </span>

      {/* status label (desktop only) */}
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary md:inline">
        {statusLabel}
      </span>
    </button>
  );
});
