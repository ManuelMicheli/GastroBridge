"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyOrdersIllustration } from "@/components/illustrations";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

import type { OrderFeedRow, OrderStats } from "./_lib/types";

const OPEN_STATUSES = new Set([
  "draft",
  "submitted",
  "pending",
  "pending_confirmation",
  "confirmed",
  "preparing",
  "packed",
  "shipping",
  "in_transit",
  "shipped",
  "stock_conflict",
]);

const CLOSED_STATUSES = new Set(["delivered", "completed", "cancelled", "rejected"]);

type Filter = "open" | "closed" | "all";

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("it")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function initials(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function shortId(id: string, isSplit: boolean): string {
  const n = id.replace(/-/g, "").slice(-4).toUpperCase();
  return `ORD-${n}${isSplit ? "·+" : ""}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function OrdersClientMobile({
  orders,
  stats,
}: {
  orders: OrderFeedRow[];
  stats: OrderStats;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query);
    return orders.filter((o) => {
      if (filter === "open" && !OPEN_STATUSES.has(o.status)) return false;
      if (filter === "closed" && !CLOSED_STATUSES.has(o.status)) return false;
      if (!q) return true;
      const hay = [
        o.id,
        o.supplierName ?? "",
        o.notes ?? "",
      ]
        .map((s) => normalize(s))
        .join(" ");
      return hay.includes(q);
    });
  }, [orders, filter, query]);

  const openCount = orders.filter((o) => OPEN_STATUSES.has(o.status)).length;
  const closedCount = orders.filter((o) => CLOSED_STATUSES.has(o.status)).length;

  async function handleRefresh() {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("_r", String(Date.now()));
      window.location.replace(url.pathname + url.search);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="px-4 pt-4">
        <LargeTitle
          eyebrow="Gestione ordini"
          title="Ordini"
          subtitle="Ricezione merce dai tuoi fornitori."
        />
        <EmptyState
          title="Nessun ordine ancora"
          description="Quando crei il primo ordine, comparirà qui con stato e timeline."
          illustration={<EmptyOrdersIllustration />}
          context="page"
        />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-4">
        <LargeTitle
          eyebrow={`Ultimi 30 giorni · ${formatCurrency(stats.monthTotal)}`}
          title={`${stats.totalCount} ordini`}
        />

        {/* Search inset + filter */}
        <div className="mx-3 mt-3 flex items-center gap-2">
          <div className="relative flex flex-1 items-center">
            <Search
              aria-hidden
              className="absolute left-2.5 h-4 w-4 text-[color:var(--ios-chev-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca ordine, fornitore…"
              className="h-9 w-full rounded-lg bg-[color:var(--ios-fill-quinary)] pl-8 pr-8 text-[15px] text-[color:var(--color-text-primary)] placeholder:text-[color:var(--ios-chev-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-primary)]"
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
              { value: "open", label: "In corso", count: openCount },
              { value: "closed", label: "Chiusi", count: closedCount },
              { value: "all", label: "Tutti" },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            ariaLabel="Filtra ordini per stato"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 px-6 text-center">
            <p className="text-[color:var(--text-muted-light)]">
              Nessun ordine corrisponde ai filtri.
            </p>
            <button
              className="mt-3 text-[13px] font-medium text-[color:var(--color-brand-primary)]"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Pulisci filtri
            </button>
          </div>
        ) : (
          <GroupedList
            className="mt-4"
            label={
              filter === "open"
                ? `In corso · ${filtered.length}`
                : filter === "closed"
                  ? `Chiusi · ${filtered.length}`
                  : `Tutti · ${filtered.length}`
            }
          >
            {filtered.map((o) => (
              <GroupedListRow
                key={o.id}
                href={`/ordini/${o.id}`}
                leading={
                  <div
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[color:var(--color-brand-primary)] font-serif text-[10px] font-medium text-[color:var(--color-brand-on-primary)]"
                    style={{ fontFamily: "Georgia, serif" }}
                    aria-hidden
                  >
                    {initials(o.supplierName)}
                  </div>
                }
                title={o.supplierName ?? "Fornitore —"}
                subtitle={
                  <span className="font-mono text-[10px]">
                    {shortId(o.id, o.supplierCount > 1)} · {shortDate(o.createdAt)} ·{" "}
                    {formatCurrency(o.total)}
                  </span>
                }
                trailing={<OrderStatusBadge status={o.status} size="xs" />}
              />
            ))}
          </GroupedList>
        )}
      </div>
    </PullToRefresh>
  );
}
