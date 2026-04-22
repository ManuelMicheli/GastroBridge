// components/dashboard/supplier/_awwwards/recent-orders-log.tsx
//
// Dense 40px-row recent-orders log for the supplier dashboard.
// Rows carry split id + restaurant name + status dot + total.
// Clicks route to /supplier/ordini/{splitId}.

"use client";

import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/formatters";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { StatusDot } from "@/components/ui/status-dot";

export type SupplierDashboardOrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  restaurant_name: string;
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

export function SupplierRecentOrdersLog({
  rows,
}: {
  rows: SupplierDashboardOrderRow[];
}) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
        Nessun ordine ricevuto — i nuovi ordini appaiono qui
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const meta = getOrderStatusMeta(row.status);
        const label = meta.label;
        const ts = formatTime(row.created_at);
        const shortId = row.id.slice(0, 8).toUpperCase();
        const restaurant =
          row.restaurant_name && row.restaurant_name !== "—"
            ? row.restaurant_name
            : "Ristorante";

        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => router.push(`/supplier/ordini/${row.id}`)}
              className="group grid w-full grid-cols-[48px_10px_minmax(0,1fr)_auto] items-center gap-x-3 border-l-2 border-transparent px-2 text-left transition-colors hover:border-accent-green hover:bg-surface-hover sm:grid-cols-[56px_10px_minmax(0,1fr)_auto_auto]"
              style={{ minHeight: 40 }}
            >
              <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
                {ts}
              </span>

              <StatusDot
                tone={meta.tone}
                size={8}
                pulse={meta.pulse}
                className="shrink-0"
              />

              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-[12px] text-text-primary">
                  #{shortId}
                </span>
                <span className="truncate text-[13px] text-text-secondary">
                  {restaurant}
                </span>
              </span>

              <span className="font-mono text-[13px] tabular-nums text-text-primary">
                {formatCurrency(row.total)}
              </span>

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
