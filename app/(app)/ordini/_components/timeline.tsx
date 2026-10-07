// app/(app)/ordini/_components/timeline.tsx
"use client";

import { useMemo } from "react";
import { bucketize, bucketLabel } from "../_lib/bucketize";
import type { OrderFeedRow } from "../_lib/types";
import { TimelineRow } from "./timeline-row";

export function Timeline({
  rows,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  rows: OrderFeedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
}) {
  const buckets = useMemo(() => bucketize(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-[13px] text-[var(--f-muted)]">
          {emptyLabel}
        </p>
      </div>
    );
  }

  // Flat index of rows → used for DOM ids (scroll/focus).
  const flatIds = rows.map((r) => r.id);

  return (
    <div className="flex flex-col">
      {buckets.map(({ bucket, rows: bucketRows }) => (
        <section key={bucket} className="py-1">
          <header
            className="flex items-center gap-2 px-4 pt-4 pb-2"
            aria-label={bucketLabel(bucket)}
          >
            <span className="f-eyebrow">
              {bucketLabel(bucket)}
            </span>
            <span className="ml-auto text-[12px] font-medium tabular-nums text-[var(--f-muted)]">
              {bucketRows.length}
            </span>
          </header>
          <ul className="flex flex-col gap-0.5 px-2">
            {bucketRows.map((row) => (
              <li key={row.id}>
                <TimelineRow
                  row={row}
                  bucket={bucket}
                  selected={selectedId === row.id}
                  onSelect={onSelect}
                  rowId={`order-row-${flatIds.indexOf(row.id)}`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
