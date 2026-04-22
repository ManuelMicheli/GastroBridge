"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Keyboard, LayoutGrid, List, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";
import { SupplierOrdersClientMobile } from "./orders-client-mobile";
import { SupplierStatusChips } from "./_components/status-chips";
import { SupplierTimeline } from "./_components/timeline";
import { SupplierOrderPeek } from "./_components/order-peek";
import type {
  SupplierOrderStats,
  SupplierTimelineRow,
} from "./_lib/types";
import { readUrlState, writeUrlState } from "./_lib/url-state";

export type SupplierOrderRow = SupplierTimelineRow;

type Filters = {
  state: string;
  restaurant: string;
  from: string;
  to: string;
};

type Props = {
  orders: SupplierOrderRow[];
  filters: Filters;
  total: number;
};

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("it")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function computeStats(rows: SupplierOrderRow[]): SupplierOrderStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let monthTotal = 0;
  const statusCounts: Record<string, number> = {};
  for (const r of rows) {
    const d = new Date(r.createdAt);
    if (!Number.isNaN(d.getTime()) && d >= monthStart) {
      monthTotal += Number(r.subtotal || 0);
    }
    statusCounts[r.workflowState] = (statusCounts[r.workflowState] ?? 0) + 1;
  }
  return { totalCount: rows.length, monthTotal, statusCounts };
}

export function SupplierOrdersClient({ orders, filters, total }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const initial = useMemo(
    () => readUrlState(new URLSearchParams(sp.toString())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [query, setQuery] = useState(initial.query || filters.restaurant);
  const [statuses, setStatuses] = useState<Set<string>>(() => {
    const s = new Set(initial.statuses);
    if (filters.state) s.add(filters.state);
    return s;
  });
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [fromDate, setFromDate] = useState(initial.from || filters.from);
  const [toDate, setToDate] = useState(initial.to || filters.to);
  const [peekOpenMobile, setPeekOpenMobile] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => computeStats(orders), [orders]);

  // Client-side filter (status + free-text).
  // Server has already filtered by state + restaurant + from/to, but keeping
  // client-side filters lets user refine without a round trip once loaded.
  const filtered = useMemo(() => {
    const q = normalize(deferredQuery);
    return orders.filter((o) => {
      if (statuses.size > 0 && !statuses.has(o.workflowState)) return false;
      if (!q) return true;
      const hay = [
        o.splitId,
        o.orderNumber ?? "",
        o.restaurantName,
        o.zoneName ?? "",
      ]
        .map((s) => normalize(s))
        .join(" ");
      return hay.includes(q);
    });
  }, [orders, statuses, deferredQuery]);

  const selectedRow = useMemo(
    () =>
      selectedId ? orders.find((o) => o.splitId === selectedId) ?? null : null,
    [orders, selectedId],
  );

  useEffect(() => {
    if (selectedId && !orders.some((o) => o.splitId === selectedId)) {
      setSelectedId(null);
    }
  }, [orders, selectedId]);

  // URL sync (debounced) — preserves server-driven params (state/from/to/restaurant).
  useEffect(() => {
    const t = setTimeout(() => {
      const params = writeUrlState({
        query,
        statuses,
        selectedId,
        from: fromDate,
        to: toDate,
      });
      // Keep the single-state server param in sync for page.tsx server query.
      const firstStatus = [...statuses][0] ?? "";
      if (firstStatus) params.set("state", firstStatus);
      else params.delete("state");
      // page.tsx reads `restaurant`, mirror the client free-text query there.
      if (query) params.set("restaurant", query);
      else params.delete("restaurant");

      const qs = params.toString();
      router.replace(qs ? `/supplier/ordini?${qs}` : "/supplier/ordini", {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query, statuses, selectedId, fromDate, toDate, router]);

  const toggleStatus = useCallback((s: string) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }, []);

  const clearStatuses = useCallback(() => setStatuses(new Set()), []);

  const onSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPeekOpenMobile(true);
  }, []);

  return (
    <>
      {/* Mobile Apple-app view — untouched */}
      <div className="lg:hidden">
        <SupplierOrdersClientMobile orders={orders} total={total} />
      </div>

      {/* Desktop terminal-dense command timeline */}
      <div className="hidden lg:flex h-[calc(100vh-var(--chrome-top,64px))] flex-col">
        {/* Top bar: title + stats + view toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-primary">
              Ordini
            </h1>
            <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
              {stats.totalCount} totali
            </span>
            <span aria-hidden className="text-text-tertiary">
              ·
            </span>
            <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
              {formatCurrency(stats.monthTotal)}{" "}
              <span className="uppercase tracking-[0.06em]">questo mese</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border-subtle bg-surface-card p-0.5">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-sm bg-accent-green/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green"
                aria-pressed="true"
              >
                <List className="h-3 w-3" aria-hidden />
                Timeline
              </button>
              <Link
                href="/supplier/ordini/kanban"
                className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary hover:bg-surface-hover"
              >
                <LayoutGrid className="h-3 w-3" aria-hidden />
                Kanban
              </Link>
            </div>
            <button
              className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
              title="Scorciatoie"
              disabled
            >
              <Keyboard className="h-3.5 w-3.5" /> ?
            </button>
          </div>
        </div>

        {/* Chips row */}
        <div className="border-b border-border-subtle px-4 py-2.5">
          <SupplierStatusChips
            counts={stats.statusCounts}
            selected={statuses}
            onToggle={toggleStatus}
            onClear={clearStatuses}
          />
        </div>

        {/* Search + date range row */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2">
          <div className="relative flex flex-1 items-center min-w-[240px]">
            <Search
              aria-hidden
              className="absolute left-2 h-3.5 w-3.5 text-text-tertiary"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per id, ristorante, zona..."
              className="w-full rounded-md border border-border-subtle bg-surface-base py-1.5 pl-7 pr-7 font-mono text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-green focus:outline-none"
              aria-label="Cerca split"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-1.5 rounded-sm p-0.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
                aria-label="Pulisci ricerca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            <span>Dal</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-border-subtle bg-surface-base px-2 py-1 font-mono text-[11px] text-text-primary focus:border-accent-green focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            <span>Al</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-border-subtle bg-surface-base px-2 py-1 font-mono text-[11px] text-text-primary focus:border-accent-green focus:outline-none"
            />
          </label>
          <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
            {filtered.length}/{orders.length}
          </span>
        </div>

        {/* Main: timeline (left) + peek (right) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-h-0 overflow-y-auto">
            <SupplierTimeline
              rows={filtered}
              selectedId={selectedId}
              onSelect={onSelect}
              emptyLabel={
                orders.length > 0
                  ? "Nessun ordine corrisponde ai filtri"
                  : "Nessun ordine ricevuto"
              }
            />
            {filtered.length === 0 && orders.length > 0 && (
              <div className="px-4 pb-8 pt-4 text-center">
                <button
                  onClick={() => {
                    setQuery("");
                    setStatuses(new Set());
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent-green hover:underline"
                >
                  Pulisci filtri
                </button>
              </div>
            )}
          </div>

          <div className="hidden border-l border-border-subtle lg:block">
            <SupplierOrderPeek
              row={selectedRow}
              onClose={() => setSelectedId(null)}
            />
          </div>

          {selectedRow && peekOpenMobile && (
            <div
              className="fixed inset-0 z-30 bg-black/40 lg:hidden"
              onClick={() => setPeekOpenMobile(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-0 w-full max-w-md bg-surface-card shadow-2xl"
              >
                <SupplierOrderPeek
                  row={selectedRow}
                  onClose={() => {
                    setPeekOpenMobile(false);
                    setSelectedId(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
