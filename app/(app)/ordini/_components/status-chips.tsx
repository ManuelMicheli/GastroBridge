// app/(app)/ordini/_components/status-chips.tsx
"use client";

import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import { statusColorClass } from "../_lib/bucketize";

// Statuses we expose as filter chips, in display order.
// We hide `draft` by default (rare in the user feed) and only surface it
// in the chip row if some orders actually have it — handled by the caller
// via `counts`.
const CANONICAL_ORDER: string[] = [
  "pending",
  "submitted",
  "confirmed",
  "preparing",
  "in_transit",
  "shipping",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "draft",
];

export function StatusChips({
  counts,
  selected,
  onToggle,
  onClear,
}: {
  counts: Record<string, number>;
  selected: Set<string>;
  onToggle: (status: string) => void;
  onClear: () => void;
}) {
  // Show all statuses that appear in the data at least once.
  const present = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => {
      const ai = CANONICAL_ORDER.indexOf(a);
      const bi = CANONICAL_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  if (present.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {present.map(([status, count]) => {
        const active = selected.has(status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
              active
                ? "border-accent-green bg-accent-green/10 text-accent-green"
                : "border-border-subtle text-text-secondary hover:bg-surface-hover"
            }`}
            aria-pressed={active}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${statusColorClass(status)}`}
              aria-hidden
            />
            <span className="whitespace-nowrap">
              {ORDER_STATUS_LABELS[status] ?? status}
            </span>
            <span
              className={`font-mono tabular-nums ${
                active ? "text-accent-green" : "text-text-tertiary"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center rounded-full px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary hover:text-text-primary"
        >
          Pulisci
        </button>
      )}
    </div>
  );
}
