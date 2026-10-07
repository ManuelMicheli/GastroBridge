// app/(app)/ordini/_components/timeline-row.tsx
"use client";

import { forwardRef } from "react";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { Avatar, OrderStatusPill } from "@/components/fernly/primitives";
import { formatCurrency } from "@/lib/utils/formatters";
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
  const statusLabel = getOrderStatusMeta(row.status).label;
  const ts = formatTimestamp(row.createdAt, bucket);
  const shortId = row.id.slice(0, 8).toUpperCase();

  return (
    <button
      ref={ref}
      id={rowId}
      type="button"
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      aria-label={`Ordine ${shortId}, ${statusLabel}`}
      data-selected={selected ? "true" : "false"}
      className={`group grid w-full grid-cols-[36px_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-[14px] px-2 py-2 text-left transition-colors ${
        selected
          ? "bg-[var(--acc-50)] ring-1 ring-[color:color-mix(in_oklab,var(--acc-600)_35%,transparent)]"
          : "hover:bg-[var(--f-fill)]"
      }`}
      style={{ minHeight: 52 }}
    >
      <Avatar name={row.supplierName ?? shortId} size={36} />

      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-[var(--f-ink)]">
          {row.supplierName ?? "—"}
          {row.supplierCount > 1 && (
            <span className="ml-1 text-[11.5px] font-normal text-[var(--f-muted)]">
              +{row.supplierCount - 1}
            </span>
          )}
        </span>
        <span className="block truncate text-[12px] text-[var(--f-muted)]">
          #{shortId} · {ts}
        </span>
      </span>

      <span className="text-[14px] font-semibold tabular-nums text-[var(--f-ink)]">
        {formatCurrency(row.total)}
      </span>

      <span className="hidden md:inline-flex">
        <OrderStatusPill status={row.status} />
      </span>
    </button>
  );
});
