// app/(app)/ordini/_components/order-board.tsx
"use client";

import { Clock, Hash } from "lucide-react";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";
import { formatCurrency } from "@/lib/utils/formatters";
import { Avatar, orderTone, riseStyle } from "@/components/fernly/primitives";
import { cn } from "@/lib/utils/formatters";
import type { OrderFeedRow } from "../_lib/types";

type Column = {
  id: string;
  label: string;
  dot: string;
  statuses: string[];
};

// Read-only status board (Fernly kanban language). Order status is driven by
// the suppliers' workflow, so cards are not draggable here.
export const BOARD_COLUMNS: Column[] = [
  {
    id: "waiting",
    label: "In attesa",
    dot: "#9AA19E",
    statuses: ["draft", "pending", "submitted", "pending_confirmation", "pending_customer_confirmation", "stock_conflict"],
  },
  { id: "confirmed", label: "Confermati", dot: "#D99A2B", statuses: ["confirmed", "preparing", "packed"] },
  { id: "transit", label: "In consegna", dot: "#4C6FD8", statuses: ["shipping", "shipped", "in_transit"] },
  { id: "closed", label: "Chiusi", dot: "#2E9463", statuses: ["delivered", "completed", "cancelled", "rejected"] },
];

const PROGRESS: Record<string, number> = {
  draft: 0.05,
  pending: 1 / 7,
  submitted: 1 / 7,
  pending_confirmation: 1 / 7,
  pending_customer_confirmation: 1 / 7,
  stock_conflict: 1 / 7,
  confirmed: 2 / 7,
  preparing: 3 / 7,
  packed: 4 / 7,
  shipping: 5 / 7,
  shipped: 5 / 7,
  in_transit: 5 / 7,
  delivered: 6 / 7,
  completed: 1,
  cancelled: 1,
  rejected: 1,
};

function relDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Ieri";
  if (diff < 7) return `${diff}g fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(d);
}

export function OrderBoard({
  rows,
  selectedId,
  onSelect,
}: {
  rows: OrderFeedRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const known = new Set(BOARD_COLUMNS.flatMap((c) => c.statuses));
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {BOARD_COLUMNS.map((col, ci) => {
        const items = rows.filter((r) =>
          col.id === "waiting" ? col.statuses.includes(r.status) || !known.has(r.status) : col.statuses.includes(r.status),
        );
        return (
          <section key={col.id} className="f-rise min-w-0" style={riseStyle(ci)} aria-label={col.label}>
            <header className="mb-2.5 flex items-center gap-2 px-1">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: col.dot }} />
              <h2 className="text-[14px] font-semibold text-[var(--f-ink)]">{col.label}</h2>
              <span className="ml-auto text-[12.5px] font-medium text-[var(--f-muted)] tabular-nums">{items.length}</span>
            </header>
            <ul className="flex min-h-[120px] flex-col gap-2.5 rounded-[18px]">
              {items.length === 0 ? (
                <li className="rounded-[16px] border border-dashed border-[var(--f-line-strong)] px-4 py-6 text-center text-[12.5px] text-[var(--f-faint)]">
                  Nessun ordine
                </li>
              ) : (
                items.map((r, i) => (
                  <li key={r.id} className="f-rise" style={riseStyle(ci + i * 0.6, 120)}>
                    <BoardCard row={r} selected={r.id === selectedId} onSelect={onSelect} />
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({
  row,
  selected,
  onSelect,
}: {
  row: OrderFeedRow;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const meta = getOrderStatusMeta(row.status);
  const tone = orderTone(row.status);
  const progress = PROGRESS[row.status] ?? 0.1;
  const ko = meta.terminal === "ko";
  const ok = meta.terminal === "ok";
  const name = row.supplierName ?? `Ordine #${row.id.slice(0, 8).toUpperCase()}`;
  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      className={cn(
        "f-card group block w-full !rounded-[16px] p-4 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--elevation-card-hover)]",
        selected && "ring-[1.5px] ring-[var(--acc-600)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="f-status !h-[21px] !rounded-[7px] !text-[11px]" data-tone={tone}>
          {meta.label}
        </span>
        {row.supplierCount > 1 ? (
          <span className="f-tag !h-[21px] bg-[var(--f-fill-2)] !text-[11px] text-[var(--f-ink-2)]">
            {row.supplierCount} fornitori
          </span>
        ) : null}
      </div>
      <p className={cn("mt-2.5 truncate text-[14.5px] font-semibold text-[var(--f-ink)]", ko && "line-through decoration-[var(--f-faint)]")}>
        {name}
      </p>
      <div className="mt-3 h-[5px] w-full overflow-hidden rounded-full bg-[var(--f-fill-2)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(progress * 100)}%`,
            background: ko ? "var(--f-danger)" : ok ? "var(--f-success)" : "var(--acc-600)",
          }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2.5 whitespace-nowrap text-[12px] text-[var(--f-muted)]">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {relDay(row.createdAt)}
        </span>
        <span className="hidden items-center gap-0.5 2xl:inline-flex">
          <Hash className="h-3.5 w-3.5" />
          {row.id.slice(0, 6).toUpperCase()}
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-2">
          <b className="font-semibold text-[var(--f-ink)] tabular-nums">{formatCurrency(row.total)}</b>
          <span className="flex -space-x-2">
            <Avatar name={name} size={26} ring />
            {row.supplierCount > 1 ? (
              <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--f-fill-2)] text-[10px] font-semibold text-[var(--f-ink-2)] ring-2 ring-[var(--f-card)]">
                +{row.supplierCount - 1}
              </span>
            ) : null}
          </span>
        </span>
      </div>
    </button>
  );
}
