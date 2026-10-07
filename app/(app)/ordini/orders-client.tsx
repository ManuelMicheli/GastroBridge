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
import { Keyboard, Plus, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyOrdersIllustration } from "@/components/illustrations";
import { formatCurrency } from "@/lib/utils/formatters";
import { CheatsheetOverlay, useSearchKeyboard } from "@/components/shared/awwwards";

import type { OrderDelivery, OrderFeedRow, OrderStats } from "./_lib/types";
import { readUrlState, writeUrlState } from "./_lib/url-state";
import { StatusChips } from "./_components/status-chips";
import { Timeline } from "./_components/timeline";
import { OrderPeek } from "./_components/order-peek";
import { OrdersClientMobile } from "./orders-client-mobile";
import { OrderBoard } from "./_components/order-board";
import { Chips } from "@/components/fernly/chips";
import { Drawer } from "@/components/fernly/drawer";
import { MonthCalendar, type CalEvent, type CalTone } from "@/components/fernly/month-calendar";
import { useWeekStartsOn } from "@/components/fernly/appearance-provider";
import { getOrderStatusMeta } from "@/lib/orders/status-meta";

type ViewMode = "board" | "list" | "calendar";

function deliveryTone(status: string): CalTone {
  const tone = getOrderStatusMeta(status).tone;
  if (tone === "emerald") return "green";
  if (tone === "rose") return "red";
  if (tone === "blue") return "blue";
  if (tone === "brand") return "accent";
  if (tone === "amber") return "amber";
  return "neutral";
}

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
  deliveries = [],
}: {
  orders: OrderFeedRow[];
  stats: OrderStats;
  deliveries?: OrderDelivery[];
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
  // Desktop view: status board (default), the existing list + peek, or the
  // delivery calendar. A deep link with ?sel= keeps opening the list.
  const [view, setView] = useState<ViewMode>(() => {
    const v = sp.get("view");
    if (v === "list" || v === "calendar" || v === "board") return v;
    return initial.selectedId ? "list" : "board";
  });
  const weekStartsOn = useWeekStartsOn();

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
      if (view !== "board") params.set("view", view);
      const qs = params.toString();
      router.replace(qs ? `/ordini?${qs}` : "/ordini", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, statuses, selectedId, view, router]);

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

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const calendarEvents = useMemo<CalEvent[]>(
    () =>
      deliveries.map((d, i) => {
        const o = orderById.get(d.orderId);
        return {
          id: `${d.orderId}-${i}`,
          date: d.date,
          title: d.supplierName ?? `Ordine #${d.orderId.slice(0, 8).toUpperCase()}`,
          subtitle: getOrderStatusMeta(d.status).label,
          tone: deliveryTone(d.status),
          href: `/ordini/${d.orderId}`,
          meta: o ? formatCurrency(o.total) : undefined,
        };
      }),
    [deliveries, orderById],
  );

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
          actions={
            <Link href="/cerca" className="f-btn f-btn-primary">
              <Plus className="h-4 w-4" /> Nuovo ordine
            </Link>
          }
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

      {/* Desktop — Fernly board / list / calendar */}
      <div className="hidden lg:block">
        <PageHeader
          title="Ordini"
          subtitle={`${stats.totalCount} ordini · ${formatCurrency(stats.monthTotal)} questo mese`}
          meta={
            <Chips
              size="sm"
              ariaLabel="Vista"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: "Bacheca" },
                { value: "list", label: "Elenco" },
                { value: "calendar", label: "Calendario consegne" },
              ]}
            />
          }
          actions={
            <>
              <button
                onClick={() => setHelpOpen(true)}
                className="f-icon-btn"
                title="Scorciatoie"
                aria-label="Scorciatoie da tastiera"
              >
                <Keyboard className="h-4 w-4" />
              </button>
              <Link href="/cerca" className="f-btn f-btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.2} /> Nuovo ordine
              </Link>
            </>
          }
        />

        {view === "calendar" ? (
          <MonthCalendar
            events={calendarEvents}
            weekStartsOn={weekStartsOn}
            todayTitle="Oggi"
            upcomingTitle="Prossime consegne"
            emptyToday="Nessuna consegna prevista oggi."
            emptyUpcoming="Nessuna consegna in programma."
            legend={[
              { tone: "amber", label: "In attesa" },
              { tone: "blue", label: "Confermata" },
              { tone: "accent", label: "In consegna" },
              { tone: "green", label: "Consegnata" },
              { tone: "red", label: "Annullata" },
            ]}
          />
        ) : (
          <>
            {/* Filters: status chips · search · count */}
            <div className="f-fade mb-5 flex items-center justify-between gap-3" style={{ ["--d" as string]: "100ms" }}>
              <div className="min-w-0 flex-1">
                <StatusChips
                  counts={stats.statusCounts}
                  selected={statuses}
                  onToggle={toggleStatus}
                  onClear={clearStatuses}
                />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-[12.5px] text-[var(--f-muted)] tabular-nums">
                  {filtered.length} ordini mostrati
                </span>
                <label className="relative flex h-10 w-[260px] items-center">
                  <Search aria-hidden className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--f-muted)]" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cerca per id, fornitore, note..."
                    className="h-10 w-full rounded-full border border-[var(--f-line)] bg-[var(--f-card)] pl-10 pr-9 text-[13.5px] text-[var(--f-ink)] outline-none placeholder:text-[var(--f-faint)] focus:border-[color:color-mix(in_oklab,var(--acc-600)_50%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc-600)_14%,transparent)]"
                    aria-label="Cerca ordini"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 rounded-full p-1 text-[var(--f-muted)] hover:bg-[var(--f-fill)]"
                      aria-label="Pulisci ricerca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
              </div>
            </div>

            {view === "board" ? (
              <>
                <OrderBoard rows={filtered} selectedId={selectedId} onSelect={onSelect} />
                <Drawer
                  open={selectedRow !== null && peekOpenMobile}
                  onClose={() => setPeekOpenMobile(false)}
                  label="Dettaglio ordine"
                >
                  <div className="-mx-6 -mt-8">
                    <OrderPeek
                      row={selectedRow}
                      onClose={() => {
                        setPeekOpenMobile(false);
                        setSelectedId(null);
                      }}
                    />
                  </div>
                </Drawer>
              </>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-4">
                <section className="f-card f-rise min-h-0 overflow-hidden" aria-label="Elenco ordini">
                  <div className="f-scroll max-h-[calc(100vh-300px)] min-h-[360px] overflow-y-auto pb-3">
                    <Timeline
                      rows={filtered}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      emptyLabel="Nessun ordine corrisponde ai filtri"
                    />
                    {filtered.length === 0 && (
                      <div className="px-4 pb-8 pt-2 text-center">
                        <button
                          onClick={() => {
                            setQuery("");
                            setStatuses(new Set());
                          }}
                          className="f-btn f-btn-sm f-btn-outline"
                        >
                          Pulisci filtri
                        </button>
                      </div>
                    )}
                  </div>
                </section>
                <aside className="f-card f-rise sticky top-[96px] self-start min-h-[420px] overflow-hidden" style={{ ["--i" as string]: 1 }}>
                  <OrderPeek row={selectedRow} onClose={() => setSelectedId(null)} />
                </aside>
              </div>
            )}
          </>
        )}

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
