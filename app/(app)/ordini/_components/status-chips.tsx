// app/(app)/ordini/_components/status-chips.tsx
"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";

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
    <div className="f-chips flex-wrap !rounded-[22px]" role="group" aria-label="Filtra per stato">
      <button
        type="button"
        onClick={onClear}
        data-active={selected.size === 0}
        aria-pressed={selected.size === 0}
        className={`f-chip ${selected.size === 0 ? "!bg-[linear-gradient(180deg,color-mix(in_oklab,var(--acc-700)_65%,var(--acc-800)),var(--acc-800))]" : ""}`}
      >
        Tutti
      </button>
      {present.map(([status, count]) => {
        const active = selected.has(status);
        const tone = getOrderStatusMeta(status).tone;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onToggle(status)}
            data-active={active}
            className={`f-chip ${active ? "!bg-[linear-gradient(180deg,color-mix(in_oklab,var(--acc-700)_65%,var(--acc-800)),var(--acc-800))]" : ""}`}
            aria-pressed={active}
          >
            <StatusDot tone={tone} size={7} />
            <span className="whitespace-nowrap">
              {getOrderStatusMeta(status).label}
            </span>
            <span className="f-chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
