"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

import type { SupplierOrderRow } from "./orders-client";

type Filter = "new" | "open" | "done";

const NEW_STATES = new Set([
  "submitted",
  "pending_customer_confirmation",
  "stock_conflict",
]);
const OPEN_STATES = new Set([
  "confirmed",
  "preparing",
  "packed",
  "shipping",
  "in_transit",
]);
const DONE_STATES = new Set(["delivered", "completed", "rejected", "cancelled"]);

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("it")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function SupplierOrdersClientMobile({
  orders,
  total,
}: {
  orders: SupplierOrderRow[];
  total: number;
}) {
  const [filter, setFilter] = useState<Filter>("new");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query);
    return orders.filter((o) => {
      if (filter === "new" && !NEW_STATES.has(o.workflowState)) return false;
      if (filter === "open" && !OPEN_STATES.has(o.workflowState)) return false;
      if (filter === "done" && !DONE_STATES.has(o.workflowState)) return false;
      if (!q) return true;
      const hay = [
        o.restaurantName,
        o.orderNumber ?? "",
        o.zoneName ?? "",
      ]
        .map(normalize)
        .join(" ");
      return hay.includes(q);
    });
  }, [orders, filter, query]);

  const newCount = orders.filter((o) => NEW_STATES.has(o.workflowState)).length;
  const openCount = orders.filter((o) => OPEN_STATES.has(o.workflowState)).length;
  const doneCount = orders.filter((o) => DONE_STATES.has(o.workflowState))
    .length;

  async function handleRefresh() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.pathname + url.search);
    }
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-4">
        <LargeTitle
          eyebrow={`${total} ordini totali`}
          title="Ordini"
          subtitle={
            newCount > 0
              ? `${newCount} da gestire`
              : "Nessun ordine in attesa"
          }
          actions={
            <Link
              href="/supplier/ordini/kanban"
              className="flex h-9 items-center gap-1 rounded-lg bg-[color:var(--color-brand-primary-subtle)] px-3 text-[12px] font-semibold text-[color:var(--color-brand-primary)] active:bg-[color:var(--color-brand-primary)]/20"
            >
              Kanban
            </Link>
          }
        />

        <div className="mx-3 mt-3">
          <div className="relative flex items-center">
            <Search
              aria-hidden
              className="absolute left-2.5 h-4 w-4 text-[color:var(--ios-chev-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca cliente, ordine…"
              className="h-9 w-full rounded-lg bg-[color:var(--ios-fill-quinary)] pl-8 pr-8 text-[color:var(--color-text-primary)] placeholder:text-[color:var(--ios-chev-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]"
              style={{ fontSize: "16px" }}
              aria-label="Cerca ordini"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 rounded-full p-0.5 text-[color:var(--ios-chev-muted)] active:bg-black/10"
                aria-label="Pulisci"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mx-3 mt-3">
          <SegmentedControl
            options={[
              { value: "new", label: "Nuovi", count: newCount },
              { value: "open", label: "In corso", count: openCount },
              { value: "done", label: "Chiusi", count: doneCount },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            ariaLabel="Filtra ordini supplier"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 px-6 text-center text-[color:var(--text-muted-light)]">
            Nessun ordine corrisponde.
          </div>
        ) : (
          <GroupedList
            className="mt-4"
            label={`${filtered.length} ordini`}
          >
            {filtered.map((o) => (
              <GroupedListRow
                key={o.splitId}
                href={`/supplier/ordini/${o.orderId}`}
                leading={
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[10px] font-medium text-[color:var(--color-brand-on-primary)]"
                    style={{ fontFamily: "Georgia, serif" }}
                    aria-hidden
                  >
                    {initials(o.restaurantName)}
                  </div>
                }
                title={o.restaurantName}
                subtitle={
                  <span className="font-mono text-[10px]">
                    {o.orderNumber ?? "—"} · {shortDate(o.createdAt)}
                    {o.zoneName ? ` · ${o.zoneName}` : ""} ·{" "}
                    {formatCurrency(o.subtotal)}
                  </span>
                }
                trailing={
                  <OrderStatusBadge status={o.workflowState} size="xs" />
                }
              />
            ))}
          </GroupedList>
        )}
      </div>
    </PullToRefresh>
  );
}
