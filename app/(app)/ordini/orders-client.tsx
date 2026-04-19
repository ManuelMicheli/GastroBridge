// app/(app)/ordini/orders-client.tsx
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
import { Keyboard, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyOrdersIllustration } from "@/components/illustrations";
import { formatCurrency } from "@/lib/utils/formatters";
import { CheatsheetOverlay, useSearchKeyboard } from "@/components/shared/awwwards";

import type { OrderFeedRow, OrderStats } from "./_lib/types";
import { readUrlState, writeUrlState } from "./_lib/url-state";
import { StatusChips } from "./_components/status-chips";
import { Timeline } from "./_components/timeline";
import { OrderPeek } from "./_components/order-peek";
import { OrdersClientMobile } from "./orders-client-mobile";

const CHEATSHEET_ROWS = [
  { keys: ["⌘", "K"], label: "Focus ricerca" },
  { keys: ["/"], label: "Focus ricerca" },
  { keys: ["↓"], label: "Prossimo ordine" },
  { keys: ["↑"], label: "Precedente ordine" },
  { keys: ["Enter"], label: "Apri peek" },
  { keys: ["Esc"], label: "Chiudi peek / pulisci" },
  { keys: ["?"], label: "Questo aiuto" },
];

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("it")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function OrdersClient({
  orders,
  stats,
}: {
  orders: OrderFeedRow[];
  stats: OrderStats;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const initial = useMemo(
    () => readUrlState(new URLSearchParams(sp.toString())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [query, setQuery] = useState(initial.query);
  const [statuses, setStatuses] = useState<Set<string>>(initial.statuses);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [helpOpen, setHelpOpen] = useState(false);
  const [peekOpenMobile, setPeekOpenMobile] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter: status + free-text (id / supplier / notes)
  const filtered = useMemo(() => {
    const q = normalize(deferredQuery);
    return orders.filter((o) => {
      if (statuses.size > 0 && !statuses.has(o.status)) return false;
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
  }, [orders, statuses, deferredQuery]);

  const selectedRow = useMemo(
    () => (selectedId ? orders.find((o) => o.id === selectedId) ?? null : null),
    [orders, selectedId],
  );

  // Drop selection if it disappears from dataset
  useEffect(() => {
    if (selectedId && !orders.some((o) => o.id === selectedId)) {
      setSelectedId(null);
    }
  }, [orders, selectedId]);

  // URL sync (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = writeUrlState({
        query,
        statuses,
        selectedId,
      });
      const qs = params.toString();
      router.replace(qs ? `/ordini?${qs}` : "/ordini", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, statuses, selectedId, router]);

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

  // Keyboard
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  const move = useCallback(
    (dir: 1 | -1) => {
      if (filtered.length === 0) return;
      const idx = selectedId ? filtered.findIndex((o) => o.id === selectedId) : -1;
      const next = filtered[Math.max(0, Math.min(filtered.length - 1, idx + dir))];
      if (next) {
        setSelectedId(next.id);
        document
          .getElementById(`order-row-${filtered.indexOf(next)}`)
          ?.scrollIntoView({ block: "nearest" });
      }
    },
    [filtered, selectedId],
  );
  const enter = useCallback(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
    if (selectedId) setPeekOpenMobile(true);
  }, [selectedId, filtered]);
  const escape = useCallback(() => {
    if (peekOpenMobile) {
      setPeekOpenMobile(false);
      return;
    }
    if (selectedId) setSelectedId(null);
    else if (query) setQuery("");
  }, [peekOpenMobile, selectedId, query]);

  useSearchKeyboard({
    onFocusSearch: focusSearch,
    onArrow: move,
    onEnter: enter,
    onEscape: escape,
    onShowHelp: () => setHelpOpen(true),
  });

  // Empty data: keep the original empty-state so UX is consistent with
  // the rest of the app.
  if (orders.length === 0) {
    return (
      <div>
        <PageHeader
          title="Ordini"
          subtitle="Gestione ordini e ricezione merce dai tuoi fornitori."
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
    <>
      {/* Mobile Apple-app view */}
      <div className="lg:hidden">
        <OrdersClientMobile orders={orders} stats={stats} />
      </div>

      {/* Desktop terminal-dense view */}
      <div className="hidden lg:flex h-[calc(100vh-var(--chrome-top,64px))] flex-col">
      {/* Top bar: title + stats */}
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
          <button
            onClick={() => setHelpOpen(true)}
            className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
            title="Scorciatoie"
          >
            <Keyboard className="h-3.5 w-3.5" /> ?
          </button>
        </div>
      </div>

      {/* Chips row */}
      <div className="border-b border-border-subtle px-4 py-2.5">
        <StatusChips
          counts={stats.statusCounts}
          selected={statuses}
          onToggle={toggleStatus}
          onClear={clearStatuses}
        />
      </div>

      {/* Search row */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
        <div className="relative flex flex-1 items-center">
          <Search
            aria-hidden
            className="absolute left-2 h-3.5 w-3.5 text-text-tertiary"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per id, fornitore, note..."
            className="w-full rounded-md border border-border-subtle bg-surface-canvas py-1.5 pl-7 pr-7 font-mono text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-green focus:outline-none"
            aria-label="Cerca ordini"
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
        <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
          {filtered.length}/{orders.length}
        </span>
      </div>

      {/* Main: timeline (left) + peek (right on desktop) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-h-0 overflow-y-auto">
          <Timeline
            rows={filtered}
            selectedId={selectedId}
            onSelect={onSelect}
            emptyLabel={
              orders.length > 0
                ? "Nessun ordine corrisponde ai filtri"
                : "Nessun ordine"
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

        {/* Desktop peek */}
        <div className="hidden border-l border-border-subtle lg:block">
          <OrderPeek row={selectedRow} onClose={() => setSelectedId(null)} />
        </div>

        {/* Mobile peek: full-width sheet from right */}
        {selectedRow && peekOpenMobile && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setPeekOpenMobile(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-y-0 right-0 w-full max-w-md bg-surface-card shadow-2xl"
            >
              <OrderPeek
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

      <CheatsheetOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* For SEO / non-JS fallback: a plain links list isn't rendered here,
          but we still expose a hidden anchor to the detail page via peek's CTA. */}
      <noscript>
        <div className="p-4">
          <p className="text-[13px] text-text-secondary">
            Abilita JavaScript per usare il feed ordini interattivo, oppure{" "}
            <Link href="/dashboard" className="underline">
              torna alla dashboard
            </Link>
            .
          </p>
        </div>
      </noscript>

      {/* Keep cheatsheet data colocated so we can wire a custom one later
          without rewriting the overlay. */}
      <span className="sr-only" aria-hidden>
        {CHEATSHEET_ROWS.map((r) => r.label).join(" ")}
      </span>
      </div>
    </>
  );
}
