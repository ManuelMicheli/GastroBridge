// app/(supplier)/supplier/ordini/_components/status-chips.tsx
//
// Filter chips for the supplier command timeline. Chips are rendered only
// for statuses that appear in the current dataset (stats.statusCounts).

"use client";

import { StatusDot } from "@/components/ui/status-dot";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";

const CANONICAL_ORDER: string[] = [
  "submitted",
  "pending_customer_confirmation",
  "stock_conflict",
  "confirmed",
  "preparing",
  "packed",
  "shipping",
  "delivered",
  "rejected",
  "cancelled",
  "draft",
];

export function SupplierStatusChips({
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
        const meta = getOrderStatusMeta(status);
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
            <StatusDot tone={meta.tone} size={8} />
            <span className="whitespace-nowrap">{meta.label}</span>
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
