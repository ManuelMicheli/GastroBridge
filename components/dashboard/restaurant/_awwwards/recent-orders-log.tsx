// components/dashboard/restaurant/_awwwards/recent-orders-log.tsx
//
// Dense 40px-row recent-orders log styled like the /ordini timeline feed.
// Accepts the dashboard's `OrderRow` (page.tsx shape) and routes clicks to
// /ordini/{id}. Empty state uses the same tertiary caption vocabulary.

"use client";

import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "@/components/ui/status-dot";

export type DashboardOrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  supplier_name: string;
  order_number: string;
};

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

export function RecentOrdersLog({
  rows,
}: {
  rows: DashboardOrderRow[];
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun ordine ancora — inizia a cercare prodotti
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const meta = getOrderStatusMeta(row.status);
        const label = meta.label;
        const ts = formatTime(row.created_at);
        const supplier = row.supplier_name && row.supplier_name !== "—"
          ? row.supplier_name
          : "Fornitore";

        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => router.push(`/ordini/${row.id}`)}
              className="group grid w-full grid-cols-[48px_10px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-green hover:bg-surface-hover sm:grid-cols-[56px_10px_minmax(0,1fr)_auto_auto]"
              style={{ minHeight: 40 }}
            >
              {/* timestamp */}
              <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                {ts}
              </span>

              {/* status dot */}
              <StatusDot
                tone={meta.tone}
                size={8}
                className="shrink-0"
              />

              {/* id + supplier */}
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-[12px] text-text-primary">
                  {row.order_number}
                </span>
                <span className="truncate text-[13px] text-text-secondary">
                  {supplier}
                </span>
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
