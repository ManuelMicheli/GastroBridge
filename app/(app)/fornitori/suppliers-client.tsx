// app/(app)/fornitori/suppliers-client.tsx
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
import { Filter, Keyboard, Plus, Store, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { EmptySuppliersIllustration } from "@/components/illustrations";
import {
  CheatsheetOverlay,
  MobileDrawer,
  useSearchKeyboard,
} from "@/components/shared/awwwards";
import { CatalogsClient } from "@/app/(app)/cataloghi/catalogs-client";

import {
  hasActiveFacets,
  normalize,
  type RelationshipRow,
  type SortMode,
  type SupplierFacetState,
} from "./_lib/types";
import { readUrlState, writeUrlState } from "./_lib/url-state";
import {
  SupplierFilterPanel,
  type SupplierFacetCounts,
} from "./_components/supplier-filter-panel";
import { SearchBarMini } from "./_components/search-bar-mini";
import { SupplierList } from "./_components/supplier-list";
import { SupplierDetailPane } from "./_components/supplier-detail-pane";
import type { ImportedCatalog } from "./page";

type TabId = "connessi" | "importati";

export function SuppliersClient({
  relationships,
  hasRestaurant,
  importedCatalogs,
}: {
  relationships: RelationshipRow[];
  hasRestaurant: boolean;
  importedCatalogs: ImportedCatalog[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // Only rows with a hydrated supplier survive.
  const rows = useMemo(
    () => relationships.filter((r) => r.supplier !== null),
    [relationships],
  );

  const initial = useMemo(
    () => readUrlState(new URLSearchParams(sp.toString())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialTab: TabId =
    sp.get("tab") === "importati" ? "importati" : "connessi";
  const [tab, setTab] = useState<TabId>(initialTab);

  const [query, setQuery] = useState(initial.query);
  const [facets, setFacets] = useState<SupplierFacetState>(initial.facets);
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId);
  const [sort, setSort] = useState<SortMode>("recent");
  const [facetsOpen, setFacetsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search (normalized name contains)
  const searched = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    if (!q) return rows;
    return rows.filter((r) =>
      r.supplier ? normalize(r.supplier.company_name).includes(q) : false,
    );
  }, [rows, deferredQuery]);

  // Faceted filter
  const filtered = useMemo(() => {
    return searched.filter((r) => {
      const s = r.supplier!;
      if (facets.statuses.size > 0 && !facets.statuses.has(r.status)) return false;
      if (facets.verifiedOnly && !s.is_verified) return false;
      if (facets.cities.size > 0) {
        if (!s.city || !facets.cities.has(s.city)) return false;
      }
      if (facets.certs.size > 0) {
        const cs = s.certifications ?? [];
        if (!cs.some((c) => facets.certs.has(c))) return false;
      }
      if (facets.minRating > 0 && (s.rating_avg ?? 0) < facets.minRating)
        return false;
      return true;
    });
  }, [searched, facets]);

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "name") {
      list.sort((a, b) =>
        a.supplier!.company_name.localeCompare(b.supplier!.company_name, "it"),
      );
    } else if (sort === "rating") {
      list.sort(
        (a, b) => (b.supplier!.rating_avg ?? 0) - (a.supplier!.rating_avg ?? 0),
      );
    } else {
      // recent: keep server ordering (invited_at desc)
      list.sort(
        (a, b) =>
          new Date(b.invited_at).getTime() - new Date(a.invited_at).getTime(),
      );
    }
    return list;
  }, [filtered, sort]);

  // Facet counts (from searched rows so counts reflect search but not active facets)
  const counts = useMemo<SupplierFacetCounts>(() => {
    const statusMap = new Map<RelationshipRow["status"], number>();
    const cityMap = new Map<string, number>();
    const certMap = new Map<string, number>();
    let verifiedCount = 0;
    for (const r of searched) {
      const s = r.supplier!;
      statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
      if (s.city) cityMap.set(s.city, (cityMap.get(s.city) ?? 0) + 1);
      for (const c of s.certifications ?? [])
        certMap.set(c, (certMap.get(c) ?? 0) + 1);
      if (s.is_verified) verifiedCount += 1;
    }
    return {
      statuses: [...statusMap.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      cities: [...cityMap.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, "it")),
      certs: [...certMap.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      verifiedCount,
    };
  }, [searched]);

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId],
  );

  // Clear selection if it disappears entirely from dataset
  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [rows, selectedId]);

  // URL sync (debounced 300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = writeUrlState({ query, facets, selectedId });
      if (tab === "importati") params.set("tab", "importati");
      const qs = params.toString();
      router.replace(qs ? `/fornitori?${qs}` : "/fornitori", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, facets, selectedId, tab, router]);

  // Keyboard wiring
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  const move = useCallback(
    (dir: 1 | -1) => {
      if (sorted.length === 0) return;
      const idx = selectedId
        ? sorted.findIndex((r) => r.id === selectedId)
        : -1;
      const next = sorted[Math.max(0, Math.min(sorted.length - 1, idx + dir))];
      if (next) {
        setSelectedId(next.id);
        document
          .getElementById(`supplier-row-${sorted.indexOf(next)}`)
          ?.scrollIntoView({ block: "nearest" });
      }
    },
    [sorted, selectedId],
  );
  const enter = useCallback(() => {
    if (!selectedId && sorted[0]) setSelectedId(sorted[0].id);
  }, [selectedId, sorted]);
  const escape = useCallback(() => {
    if (selectedId) setSelectedId(null);
    else if (query) setQuery("");
  }, [selectedId, query]);

  useSearchKeyboard({
    onFocusSearch: focusSearch,
    onArrow: move,
    onEnter: enter,
    onEscape: escape,
    onToggleFacets: () => setFacetsOpen((v) => !v),
    onShowHelp: () => setHelpOpen(true),
  });

  // === Empty: missing restaurant ===
  if (!hasRestaurant) {
    return (
      <div>
        <PageHeader
          title="Fornitori"
          subtitle="I partner con cui hai una relazione attiva o in corso di attivazione."
        />
        <EmptyState
          title="Nessun ristorante collegato"
          description="Configura prima un ristorante per vedere i tuoi fornitori."
          context="page"
        />
      </div>
    );
  }

  // ============= TAB: importati =============
  if (tab === "importati") {
    return (
      <div className="flex min-h-[calc(100vh-var(--chrome-top,64px))] flex-col">
        <TabStrip
          tab={tab}
          onChange={setTab}
          connessiCount={rows.length}
          importatiCount={importedCatalogs.length}
        />
        <CatalogsClient initialCatalogs={importedCatalogs} />
      </div>
    );
  }

  // ============= TAB: connessi (empty) =============
  if (rows.length === 0) {
    return (
      <div>
        <TabStrip
          tab={tab}
          onChange={setTab}
          connessiCount={rows.length}
          importatiCount={importedCatalogs.length}
        />
        <PageHeader
          title="Fornitori"
          subtitle="I partner con cui hai una relazione attiva o in corso di attivazione."
          actions={
            <Link href="/fornitori/cerca">
              <Button variant="primary" size="md" density="compact">
                <Plus className="h-4 w-4" /> Aggiungi fornitore
              </Button>
            </Link>
          }
        />
        <EmptyState
          title="Nessun fornitore collegato"
          description="Trova e invita i fornitori con cui vuoi lavorare. Inizia esplorando il marketplace."
          illustration={<EmptySuppliersIllustration />}
          action={
            <Link href="/fornitori/cerca">
              <Button variant="primary" size="md" density="compact">
                <Plus className="h-4 w-4" /> Cerca fornitori
              </Button>
            </Link>
          }
          context="page"
        />
      </div>
    );
  }

  // ============= TAB: connessi (split-view) =============
  return (
    <div className="flex h-[calc(100vh-var(--chrome-top,64px))] flex-col">
      <TabStrip
        tab={tab}
        onChange={setTab}
        connessiCount={rows.length}
        importatiCount={importedCatalogs.length}
      />
      {/* Header: title + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <PageHeader
          title="Fornitori"
          subtitle={`${rows.length} relazioni`}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
            title="Scorciatoie"
          >
            <Keyboard className="h-3.5 w-3.5" /> ?
          </button>
          <Link href="/fornitori/cerca">
            <Button variant="primary" size="md" density="compact">
              <Plus className="h-4 w-4" /> Aggiungi fornitore
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_420px]">
        {/* Filter panel: desktop */}
        <div className="hidden lg:block">
          <SupplierFilterPanel
            facets={facets}
            counts={counts}
            onChange={setFacets}
          />
        </div>

        {/* Middle column */}
        <div className="flex min-h-0 flex-col">
          <SearchBarMini
            ref={searchInputRef}
            value={query}
            onChange={setQuery}
            count={sorted.length}
            total={rows.length}
            listboxId="fornitori-listbox"
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

          <SupplierList
            relationships={sorted}
            selectedId={selectedId}
            onSelect={setSelectedId}
            sort={sort}
            onSortChange={setSort}
          />
        </div>

        {/* Detail: desktop */}
        <div className="hidden lg:block">
          <SupplierDetailPane
            relationship={selected}
            onClose={() => setSelectedId(null)}
          />
        </div>

        {/* Filter drawer: mobile */}
        <MobileDrawer
          open={facetsOpen}
          onClose={() => setFacetsOpen(false)}
          side="left"
          title="Filtri"
        >
          <SupplierFilterPanel
            facets={facets}
            counts={counts}
            onChange={setFacets}
          />
        </MobileDrawer>

        {/* Detail sheet: mobile */}
        {selected && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSelectedId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-y-0 right-0 w-full max-w-md bg-surface-card shadow-2xl"
            >
              <SupplierDetailPane
                relationship={selected}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}
      </div>

      <CheatsheetOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function TabStrip({
  tab,
  onChange,
  connessiCount,
  importatiCount,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  connessiCount: number;
  importatiCount: number;
}) {
  const tabs: Array<{
    id: TabId;
    label: string;
    icon: typeof Store;
    count: number;
  }> = [
    { id: "connessi", label: "Marketplace", icon: Store, count: connessiCount },
    {
      id: "importati",
      label: "Importati",
      icon: FileSpreadsheet,
      count: importatiCount,
    },
  ];
  return (
    <div className="flex items-end gap-1 border-b border-border-subtle px-4 pt-2">
      {tabs.map((t) => {
        const active = tab === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
              active
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
            <span
              className={`ml-1 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-mono ${
                active
                  ? "bg-accent-green/15 text-accent-green"
                  : "bg-surface-hover text-text-tertiary"
              }`}
            >
              {t.count}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-1 -bottom-px h-0.5 rounded-t-full bg-accent-green"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

