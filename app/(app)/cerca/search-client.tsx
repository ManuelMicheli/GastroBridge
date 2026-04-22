// app/(app)/cerca/search-client.tsx
"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookMarked, Filter, Keyboard, ShoppingCart } from "lucide-react";
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
import { useCart } from "@/lib/hooks/useCart";
import type { UnitType } from "@/types/database";

import type { CatalogItemLite, Group, OrderLine, RankedOffer, SupplierLite } from "./_lib/types";
import { buildIndex, searchGroups } from "./_lib/product-index";
import {
  applyFacets,
  computeFacetCounts,
  emptyFacets,
  hasActiveFacets,
} from "./_lib/facets";
import { readUrlState, writeUrlState, type Tab } from "./_lib/url-state";
import { useSearchKeyboard } from "./_lib/use-keyboard";

import { FacetPanel } from "./_components/facet-panel";
import { SearchBar } from "./_components/search-bar";
import { ResultsList, type SortMode } from "./_components/results-list";
import { DetailPane } from "./_components/detail-pane";
import { TypicalOrderPanel } from "./_components/typical-order-panel";
import { UsualOrderPanel } from "./_components/usual-order-panel";
import { MobileDrawer } from "./_components/mobile-drawer";
import { CheatsheetOverlay } from "./_components/cheatsheet-overlay";
import type { UsualOrderItem } from "./_lib/usual-order";

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
  connectedSupplierIds = [],
  usualOrder = [],
}: {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
  preferences: Preferences | null;
  connectedSupplierIds?: string[];
  usualOrder?: UsualOrderItem[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const prefs = preferences ?? defaultPrefs;
  const { addItem, totalItems, totalAmount } = useCart();
  const connectedSet = useMemo(() => new Set(connectedSupplierIds), [connectedSupplierIds]);

  const addOfferToCart = useCallback(
    (group: Group, offer: RankedOffer, qty: number) => {
      const isReal = connectedSet.has(offer.supplier.id);
      addItem({
        productId: isReal ? offer.itemId : `catalog_${offer.itemId}`,
        supplierId: offer.supplier.id,
        supplierName: offer.supplier.supplier_name,
        name: `${group.productName} (${group.unit})`,
        brand: null,
        unit: (group.unit || "pz") as UnitType,
        unitPrice: offer.price,
        quantity: qty,
        imageUrl: null,
        minQuantity: 1,
      });
      toast.success(`"${group.productName}" aggiunto al carrello`);
    },
    [addItem, connectedSet],
  );

  const initial = useMemo(() => readUrlState(new URLSearchParams(sp.toString())), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [query, setQuery] = useState(initial.query);
  const [committedQuery, setCommittedQuery] = useState(initial.query);
  const [facets, setFacets] = useState(initial.facets);
  const [selectedKey, setSelectedKey] = useState<string | null>(initial.selectedKey);
  const [sort, setSort] = useState<SortMode>("relevance");
  const [facetsOpen, setFacetsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<OrderLine | null>(null);

  // committedQuery lags query only when we intentionally defer (non-empty typing).
  // Empty query commits immediately so clearing is instant and deterministic.
  const isSearching = query !== committedQuery;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build ranked Group[] + globalExcluded. Stable when items/suppliers/prefs unchanged.
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

  // Index stable by content signature so router.replace re-renders don't rebuild it.
  const groupsSignature = useMemo(
    () => groups.map((g) => g.key).join("|"),
    [groups],
  );
  const index = useMemo(() => buildIndex(groups), [groupsSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fast-path for empty query + no facets — no search, no filter pass.
  const facetsActive = hasActiveFacets(facets);
  const trimmedQuery = committedQuery.trim();

  const searched = useMemo(() => {
    if (!trimmedQuery) return groups;
    const ids = searchGroups(index, groups, trimmedQuery);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    const ordered: Group[] = [];
    for (const id of ids) {
      const g = byKey.get(id);
      if (g) ordered.push(g);
    }
    return ordered;
  }, [index, groups, trimmedQuery]);

  const filtered = useMemo(() => {
    if (!facetsActive) return searched;
    return applyFacets(searched, facets);
  }, [searched, facets, facetsActive]);

  const counts = useMemo(
    () => computeFacetCounts(searched, facets),
    [searched, facets],
  );
  const selectedGroup = useMemo(
    () => groups.find((g) => g.key === selectedKey) ?? null,
    [groups, selectedKey],
  );

  // Selection clamping — clear if completely gone from dataset.
  useEffect(() => {
    if (!selectedKey) return;
    if (!groups.some((g) => g.key === selectedKey)) setSelectedKey(null);
  }, [groups, selectedKey]);

  // Debounced URL sync — never blocks render.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = writeUrlState({ tab, query: committedQuery, facets, selectedKey });
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/cerca?${qs}` : "/cerca", { scroll: false });
      });
    }, 250);
    return () => clearTimeout(t);
  }, [tab, committedQuery, facets, selectedKey, router]);

  // Query handler: commit immediately on empty, debounce commit when typing.
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSetQuery = useCallback((next: string) => {
    setQuery(next);
    if (commitTimer.current) clearTimeout(commitTimer.current);

    if (next.trim() === "") {
      // Immediate commit — restores full list without flicker.
      setCommittedQuery(next);
      return;
    }
    commitTimer.current = setTimeout(() => {
      startTransition(() => setCommittedQuery(next));
    }, 90);
  }, []);

  useEffect(() => () => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
  }, []);

  const clearQuery = useCallback(() => handleSetQuery(""), [handleSetQuery]);
  const clearAllFilters = useCallback(() => {
    setFacets(emptyFacets());
    clearQuery();
  }, [clearQuery]);

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
    else if (query) clearQuery();
  }, [selectedKey, query, clearQuery]);
  const addSelected = useCallback(() => {
    if (!selectedGroup) return;
    const best = selectedGroup.offers[0];
    if (!best) return;
    addOfferToCart(selectedGroup, best, 1);
  }, [selectedGroup, addOfferToCart]);

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
      {/* Mobile compact tab strip */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 lg:hidden">
        <TabSwitch tab={tab} onChange={setTab} />
        <div className="flex items-center gap-2">
          {tab === "ricerca" && (
            <button
              onClick={() => setFacetsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 py-1.5 text-[12px] text-text-secondary"
            >
              <Filter className="h-3.5 w-3.5" />
              {facetsActive && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
              )}
            </button>
          )}
          <CartChip count={totalItems} total={totalAmount} compact />
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <PageHeader title="Cerca prodotti" subtitle={`${suppliers.length} cataloghi`} />
        <div className="flex items-center gap-2">
          <TabSwitch tab={tab} onChange={setTab} />
          <CartChip count={totalItems} total={totalAmount} />
          <button
            onClick={() => setHelpOpen(true)}
            className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
            title="Scorciatoie"
          >
            <Keyboard className="h-3.5 w-3.5" /> ?
          </button>
        </div>
      </div>

      <div className="hidden lg:block">
        <ActiveFiltersBar prefs={prefs} />
      </div>

      {tab === "ricerca" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_420px]">
          <div className="hidden lg:block">
            <FacetPanel facets={facets} counts={counts} onChange={setFacets} />
          </div>

          <div className="flex min-h-0 flex-col">
            <SearchBar
              ref={searchInputRef}
              value={query}
              onChange={handleSetQuery}
              onClear={clearQuery}
              count={filtered.length}
              total={groups.length}
              isSearching={isSearching}
              listboxId="search-results-listbox"
            />

            <ResultsList
              groups={filtered}
              query={committedQuery}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
              sort={sort}
              onSortChange={setSort}
              isSearching={isSearching}
              hasActiveFacets={facetsActive}
              onClearFilters={clearAllFilters}
            />

            {globalExcluded.length > 0 && (
              <div className="border-t border-border-subtle p-4">
                <ExclusionList excluded={globalExcluded} />
              </div>
            )}
          </div>

          <div className="hidden lg:block">
            <DetailPane
              group={selectedGroup}
              onClose={() => setSelectedKey(null)}
              onAddToCart={addOfferToCart}
            />
          </div>

          <MobileDrawer
            open={facetsOpen}
            onClose={() => setFacetsOpen(false)}
            side="left"
            title="Filtri"
          >
            <FacetPanel facets={facets} counts={counts} onChange={setFacets} />
          </MobileDrawer>

          {selectedGroup && (
            <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSelectedKey(null)}>
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-y-0 right-0 w-full max-w-md bg-surface-card shadow-2xl"
              >
                <DetailPane
                  group={selectedGroup}
                  onClose={() => setSelectedKey(null)}
                  onAddToCart={addOfferToCart}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "ordine" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TypicalOrderPanel
            groups={groups}
            index={index}
            pendingAdd={pendingAdd}
            onConsumedAdd={() => setPendingAdd(null)}
          />
        </div>
      )}

      {tab === "solito" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <UsualOrderPanel items={usualOrder} />
        </div>
      )}

      <CheatsheetOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function CartChip({
  count,
  total,
  compact = false,
}: {
  count: number;
  total: number;
  compact?: boolean;
}) {
  const hasItems = count > 0;
  return (
    <Link
      href="/carrello"
      prefetch={false}
      aria-label={`Vai al carrello${hasItems ? `, ${count} articoli, totale € ${total.toFixed(2)}` : ""}`}
      className={`group relative inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
        hasItems
          ? "border-accent-green/50 bg-accent-green/10 text-accent-green hover:bg-accent-green/15"
          : "border-border-subtle text-text-secondary hover:bg-surface-hover"
      }`}
    >
      <span className="relative">
        <ShoppingCart className="h-3.5 w-3.5" />
        {hasItems && (
          <span
            className="absolute -right-1.5 -top-1.5 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent-green px-1 font-mono text-[9px] font-semibold leading-none text-brand-on-primary"
            aria-hidden
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      {!compact && hasItems && (
        <span className="font-mono tabular-nums">€ {total.toFixed(2)}</span>
      )}
      {!compact && !hasItems && (
        <span className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
          carrello
        </span>
      )}
    </Link>
  );
}

function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const labels: Record<Tab, string> = {
    ricerca: "Ricerca",
    ordine: "Ordine tipico",
    solito: "Solito",
  };
  return (
    <div className="inline-flex rounded-lg border border-border-subtle bg-surface-card p-0.5">
      {(["ricerca", "ordine", "solito"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
            tab === t
              ? "bg-accent-green/15 text-accent-green"
              : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}
