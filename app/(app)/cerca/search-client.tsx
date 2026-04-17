// app/(app)/cerca/search-client.tsx
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
import { BookMarked, Filter, Keyboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  rankOffers,
  defaultPrefs,
  type Offer,
  type Preferences,
} from "@/lib/scoring";
import { ActiveFiltersBar } from "@/components/shared/scoring/active-filters-bar";
import { ExclusionList, type ExcludedItem } from "@/components/shared/scoring/exclusion-list";
import { toast } from "sonner";

import type { CatalogItemLite, Group, OrderLine, SupplierLite } from "./_lib/types";
import { buildIndex, searchGroups } from "./_lib/product-index";
import {
  applyFacets,
  computeFacetCounts,
  hasActiveFacets,
} from "./_lib/facets";
import { readUrlState, writeUrlState, type Tab } from "./_lib/url-state";
import { useSearchKeyboard } from "./_lib/use-keyboard";

import { FacetPanel } from "./_components/facet-panel";
import { SearchBar } from "./_components/search-bar";
import { ResultsList, type SortMode } from "./_components/results-list";
import { DetailPane } from "./_components/detail-pane";
import { TypicalOrderPanel } from "./_components/typical-order-panel";
import { MobileDrawer } from "./_components/mobile-drawer";
import { CheatsheetOverlay } from "./_components/cheatsheet-overlay";

export type { SupplierLite, CatalogItemLite };

function buildOffer(item: CatalogItemLite, supplier: SupplierLite): Offer {
  return {
    id: item.id,
    supplierId: supplier.id,
    productName: item.product_name,
    unit: item.unit,
    price: item.price,
    qualityTier: "standard",
    isBio: false,
    leadTimeDays: supplier.delivery_days ?? 2,
    certifications: [],
    macroCategory: "altro",
    supplierMinOrder: supplier.min_order_amount ?? undefined,
  };
}

export function SearchPageClient({
  suppliers,
  items,
  preferences,
}: {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
  preferences: Preferences | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const prefs = preferences ?? defaultPrefs;

  const initial = useMemo(() => readUrlState(new URLSearchParams(sp.toString())), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [query, setQuery] = useState(initial.query);
  const [facets, setFacets] = useState(initial.facets);
  const [selectedKey, setSelectedKey] = useState<string | null>(initial.selectedKey);
  const [sort, setSort] = useState<SortMode>("relevance");
  const [facetsOpen, setFacetsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<OrderLine | null>(null);

  const deferredQuery = useDeferredValue(query);
  const isDeferring = query !== deferredQuery;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build ranked Group[] + globalExcluded (same logic as legacy client).
  const { groups, globalExcluded } = useMemo<{
    groups: Group[];
    globalExcluded: ExcludedItem[];
  }>(() => {
    const supplierById = new Map<string, SupplierLite>();
    for (const s of suppliers) supplierById.set(s.id, s);

    type RawBucket = {
      key: string;
      productName: string;
      unit: string;
      entries: { item: CatalogItemLite; supplier: SupplierLite }[];
    };
    const buckets = new Map<string, RawBucket>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const key = `${it.product_name_normalized}::${it.unit}`;
      let b = buckets.get(key);
      if (!b) {
        b = { key, productName: it.product_name, unit: it.unit, entries: [] };
        buckets.set(key, b);
      }
      b.entries.push({ item: it, supplier });
    }

    const excludedAll: ExcludedItem[] = [];
    const built: Group[] = [];

    for (const b of buckets.values()) {
      const offers: Offer[] = b.entries.map(({ item, supplier }) => buildOffer(item, supplier));
      const result = rankOffers(offers, prefs);

      const byId = new Map<string, { item: CatalogItemLite; supplier: SupplierLite }>();
      for (const e of b.entries) byId.set(e.item.id, e);

      const ranked = [];
      for (const s of result.included) {
        const pair = byId.get(s.offer.id);
        if (!pair) continue;
        ranked.push({
          scored: s,
          supplier: pair.supplier,
          itemId: pair.item.id,
          price: s.offer.price,
        });
      }

      for (const e of result.excluded) {
        const pair = byId.get(e.offer.id);
        excludedAll.push({
          offer: e.offer,
          reasons: e.reasons,
          supplierName: pair?.supplier.supplier_name,
        });
      }

      if (ranked.length === 0) continue;

      built.push({
        key: b.key,
        productName: b.productName,
        unit: b.unit,
        offers: ranked,
        averagePrice: result.averagePrice,
      });
    }

    built.sort((a, b) => a.productName.localeCompare(b.productName, "it"));
    return { groups: built, globalExcluded: excludedAll };
  }, [items, suppliers, prefs]);

  const index = useMemo(() => buildIndex(groups), [groups]);

  // Search → ids → facet-filter → Group[]
  const searched = useMemo(() => {
    const ids = searchGroups(index, groups, deferredQuery);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    const ordered: Group[] = [];
    for (const id of ids) {
      const g = byKey.get(id);
      if (g) ordered.push(g);
    }
    return ordered;
  }, [index, groups, deferredQuery]);

  const filtered = useMemo(() => applyFacets(searched, facets), [searched, facets]);
  const counts = useMemo(() => computeFacetCounts(searched, facets), [searched, facets]);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === selectedKey) ?? null,
    [groups, selectedKey],
  );

  // Selection clamping when filtered changes
  useEffect(() => {
    if (!selectedKey) return;
    if (!filtered.some((g) => g.key === selectedKey)) {
      // keep selection if it's still in unfiltered groups (user filtered it out);
      // only clear if completely gone from dataset
      if (!groups.some((g) => g.key === selectedKey)) setSelectedKey(null);
    }
  }, [filtered, groups, selectedKey]);

  // URL sync (debounced 300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = writeUrlState({ tab, query, facets, selectedKey });
      const qs = params.toString();
      router.replace(qs ? `/cerca?${qs}` : "/cerca", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [tab, query, facets, selectedKey, router]);

  // Keyboard wiring
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  const move = useCallback(
    (dir: 1 | -1) => {
      const list = filtered;
      if (list.length === 0) return;
      const idx = selectedKey ? list.findIndex((g) => g.key === selectedKey) : -1;
      const next = list[Math.max(0, Math.min(list.length - 1, idx + dir))];
      if (next) {
        setSelectedKey(next.key);
        document.getElementById(`result-row-${list.indexOf(next)}`)?.scrollIntoView({
          block: "nearest",
        });
      }
    },
    [filtered, selectedKey],
  );
  const enter = useCallback(() => {
    if (!selectedKey && filtered[0]) setSelectedKey(filtered[0].key);
  }, [selectedKey, filtered]);
  const escape = useCallback(() => {
    if (selectedKey) setSelectedKey(null);
    else if (query) setQuery("");
  }, [selectedKey, query]);
  const addSelected = useCallback(() => {
    if (!selectedGroup) return;
    setPendingAdd({
      key: selectedGroup.key,
      productName: selectedGroup.productName,
      unit: selectedGroup.unit,
      qty: 1,
    });
    toast.success(`"${selectedGroup.productName}" aggiunto all'ordine tipico`);
  }, [selectedGroup]);

  useSearchKeyboard(
    {
      onFocusSearch: focusSearch,
      onArrow: move,
      onEnter: enter,
      onEscape: escape,
      onAdd: addSelected,
      onToggleFacets: () => setFacetsOpen((v) => !v),
      onShowHelp: () => setHelpOpen(true),
    },
    tab === "ricerca",
  );

  const handleSetQuery = (next: string) => setQuery(next);

  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Cerca prodotti"
          subtitle="Confronta prezzi tra i tuoi cataloghi fornitore."
        />
        <EmptyState
          title="Nessun catalogo ancora"
          description="Crea il primo catalogo per iniziare."
          icon={BookMarked}
          context="page"
          action={
            <Link
              href="/cataloghi"
              className="inline-flex rounded-lg bg-brand-primary px-4 py-2 font-medium text-brand-on-primary transition-colors hover:bg-brand-primary-hover"
            >
              Vai ai cataloghi
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--chrome-top,64px))] flex-col">
      {/* Header row: title + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <PageHeader
          title="Cerca prodotti"
          subtitle={`${suppliers.length} cataloghi`}
        />
        <div className="flex items-center gap-2">
          <TabSwitch tab={tab} onChange={setTab} />
          <button
            onClick={() => setHelpOpen(true)}
            className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
            title="Scorciatoie"
          >
            <Keyboard className="h-3.5 w-3.5" /> ?
          </button>
        </div>
      </div>

      <ActiveFiltersBar prefs={prefs} />

      {tab === "ricerca" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_420px]">
          {/* Facet panel: desktop */}
          <div className="hidden lg:block">
            <FacetPanel facets={facets} counts={counts} onChange={setFacets} />
          </div>

          {/* Middle column */}
          <div className="flex min-h-0 flex-col">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={handleSetQuery}
              count={filtered.length}
              total={groups.length}
              isDeferring={isDeferring}
            />

            {/* Mobile filter trigger */}
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 lg:hidden">
              <button
                onClick={() => setFacetsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-[12px] text-text-secondary"
              >
                <Filter className="h-3.5 w-3.5" /> Filtri
                {hasActiveFacets(facets) && (
                  <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-accent-green/15 px-1 font-mono text-[9px] text-accent-green">
                    ●
                  </span>
                )}
              </button>
            </div>

            <ResultsList
              groups={filtered}
              query={deferredQuery}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              sort={sort}
              onSortChange={setSort}
              isSearching={isDeferring}
            />

            {globalExcluded.length > 0 && (
              <div className="border-t border-border-subtle p-4">
                <ExclusionList excluded={globalExcluded} />
              </div>
            )}
          </div>

          {/* Detail: desktop */}
          <div className="hidden lg:block">
            <DetailPane
              group={selectedGroup}
              onClose={() => setSelectedKey(null)}
              onAddToTypical={(line) => {
                setPendingAdd(line);
                toast.success(`"${line.productName}" aggiunto all'ordine tipico`);
              }}
            />
          </div>

          {/* Facet drawer: mobile */}
          <MobileDrawer
            open={facetsOpen}
            onClose={() => setFacetsOpen(false)}
            side="left"
            title="Filtri"
          >
            <FacetPanel facets={facets} counts={counts} onChange={setFacets} />
          </MobileDrawer>

          {/* Detail sheet: mobile (md and below) */}
          {selectedGroup && (
            <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSelectedKey(null)}>
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-0 w-full max-w-md bg-surface-card shadow-2xl"
              >
                <DetailPane
                  group={selectedGroup}
                  onClose={() => setSelectedKey(null)}
                  onAddToTypical={(line) => {
                    setPendingAdd(line);
                    toast.success(`"${line.productName}" aggiunto all'ordine tipico`);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TypicalOrderPanel
            groups={groups}
            index={index}
            pendingAdd={pendingAdd}
            onConsumedAdd={() => setPendingAdd(null)}
          />
        </div>
      )}

      <CheatsheetOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border-subtle bg-surface-card p-0.5">
      {(["ricerca", "ordine"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
            tab === t
              ? "bg-accent-green/15 text-accent-green"
              : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          {t === "ricerca" ? "Ricerca" : "Ordine tipico"}
        </button>
      ))}
    </div>
  );
}
