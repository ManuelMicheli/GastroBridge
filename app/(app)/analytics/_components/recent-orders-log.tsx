// app/(app)/analytics/_components/recent-orders-log.tsx
//
// Dense 40px-row log styled like the /ordini timeline feed.
// Consumes RecentOrderRow from lib/analytics/restaurant and routes clicks
// to /ordini/{id}. Keeps typography mono + tabular-nums to match the
// terminal-dense analytics shell.

"use client";

import { useRouter } from "next/navigation";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import { formatCurrency } from "@/lib/utils/formatters";
import { statusColorClass } from "@/app/(app)/ordini/_lib/bucketize";
import type { RecentOrderRow } from "@/lib/analytics/restaurant";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function SupplierDots({ count }: { count: number }) {
  // Up to 3 visible dots; overflow collapses to "+N".
  const visible = Math.min(count, 3);
  const overflow = count - visible;
  if (count <= 0) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-text-tertiary/70"
        />
      ))}
      {overflow > 0 ? (
        <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

export function AnalyticsRecentOrdersLog({ rows }: { rows: RecentOrderRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun ordine nel periodo
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const label = ORDER_STATUS_LABELS[row.status] ?? row.status;
        const dot = statusColorClass(row.status);
        const ts = formatTime(row.created_at);
        const shortId = row.id.slice(0, 8).toUpperCase();

        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => router.push(`/ordini/${row.id}`)}
              className="group grid w-full grid-cols-[56px_10px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-green hover:bg-surface-hover sm:grid-cols-[56px_10px_minmax(0,1fr)_auto_auto]"
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
                title={label}
              />

              {/* id + supplier dots */}
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-[12px] text-text-primary">
                  #{shortId}
                </span>
                <SupplierDots count={row.supplier_count} />
                {row.item_count > 0 ? (
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary sm:inline">
                    {row.item_count} art.
                  </span>
                ) : null}
              </span>

              {/* total */}
              <span className="font-mono text-[13px] tabular-nums text-text-primary">
                {formatCurrency(row.total)}
              </span>

              {/* status label (desktop only) */}
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary sm:inline">
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
