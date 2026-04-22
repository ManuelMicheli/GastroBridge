// app/(supplier)/supplier/ordini/_components/timeline.tsx
//
// Command timeline for supplier splits, bucketized by createdAt.

"use client";

import { useMemo } from "react";
import { bucketize, bucketLabel } from "../_lib/bucketize";
import type { SupplierTimelineRow } from "../_lib/types";
import { SupplierTimelineRowItem } from "./timeline-row";

export function SupplierTimeline({
  rows,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  rows: SupplierTimelineRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  const buckets = useMemo(() => bucketize(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          {emptyLabel}
        </p>
      </div>
    );
  }

  const flatIds = rows.map((r) => r.splitId);

  return (
    <div className="flex flex-col">
      {buckets.map(({ bucket, rows: bucketRows }) => (
        <section key={bucket} className="py-1">
          <header
            className="flex items-center gap-2 px-3 pt-4 pb-2"
            aria-label={bucketLabel(bucket)}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
              {bucketLabel(bucket)}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border-subtle" />
            <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
              {bucketRows.length}
            </span>
          </header>
          <ul className="flex flex-col">
            {bucketRows.map((row) => (
              <li key={row.splitId}>
                <SupplierTimelineRowItem
                  row={row}
                  bucket={bucket}
                  selected={selectedId === row.splitId}
                  onSelect={onSelect}
                  rowId={`supplier-order-row-${flatIds.indexOf(row.splitId)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
