"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { CheatsheetOverlay, useSearchKeyboard } from "@/components/shared/awwwards";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import type { CatalogRow } from "@/lib/catalogs/types";
import type { CatalogAggregates } from "./_lib/aggregates";
import {
  CatalogStackCard,
  type CatalogStackCardData,
} from "./_components/catalog-stack-card";
import {
  CatalogGalleryHeader,
  type SortMode,
  type GalleryStats,
} from "./_components/catalog-gallery-header";

export type CatalogSource = "manual" | "connected";

export type EnrichedCatalog = CatalogRow & {
  source: CatalogSource;
  aggregates: CatalogAggregates;
};

export type SourceFilter = "all" | "manual" | "connected";

const VALID_SORTS: readonly SortMode[] = ["updated", "name", "items"];
const VALID_SOURCES: readonly SourceFilter[] = ["all", "manual", "connected"];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isUpdatedToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function CatalogsClient({
  initialCatalogs,
}: {
  initialCatalogs: EnrichedCatalog[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // Hydrate state from URL once on mount.
  const initial = useMemo(() => {
    const params = new URLSearchParams(sp.toString());
    const q = params.get("q") ?? "";
    const s = params.get("sort");
    const sort: SortMode =
      s && (VALID_SORTS as readonly string[]).includes(s)
        ? (s as SortMode)
        : "updated";
    const src = params.get("src");
    const source: SourceFilter =
      src && (VALID_SOURCES as readonly string[]).includes(src)
        ? (src as SourceFilter)
        : "all";
    return { q, sort, source };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [query, setQuery] = useState(initial.q);
  const [sort, setSort] = useState<SortMode>(initial.sort);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initial.source);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canCompare = initialCatalogs.length >= 2;

  // Aggregate stats for header
  const stats: GalleryStats = useMemo(() => {
    const catalogCount = initialCatalogs.length;
    const totalItems = initialCatalogs.reduce(
      (acc, c) => acc + c.aggregates.itemCount,
      0,
    );
    // Avg basket proxy: mean of per-catalog priceAvg weighted by itemCount.
    let weightedSum = 0;
    let weight = 0;
    for (const c of initialCatalogs) {
      if (c.aggregates.priceAvg !== null && c.aggregates.itemCount > 0) {
        weightedSum += c.aggregates.priceAvg * c.aggregates.itemCount;
        weight += c.aggregates.itemCount;
      }
    }
    const avgBasket = weight > 0 ? weightedSum / weight : null;
    const updatedTodayCount = initialCatalogs.filter((c) =>
      isUpdatedToday(c.updated_at),
    ).length;
    return { catalogCount, totalItems, avgBasket, updatedTodayCount };
  }, [initialCatalogs]);

  // Per-source counts (for filter chip labels)
  const sourceCounts = useMemo(() => {
    let manual = 0;
    let connected = 0;
    for (const c of initialCatalogs) {
      if (c.source === "connected") connected += 1;
      else manual += 1;
    }
    return {
      all: initialCatalogs.length,
      manual,
      connected,
    };
  }, [initialCatalogs]);

  // Filter by source, then by search query
  const filtered = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return initialCatalogs.filter((c) => {
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (q && !normalize(c.supplier_name).includes(q)) return false;
      return true;
    });
  }, [initialCatalogs, deferredQuery, sourceFilter]);

  // Sort
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "name") {
      list.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, "it"));
    } else if (sort === "items") {
      list.sort((a, b) => b.aggregates.itemCount - a.aggregates.itemCount);
    } else {
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }
    return list;
  }, [filtered, sort]);

  // URL sync (debounced 300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (sort !== "updated") params.set("sort", sort);
      if (sourceFilter !== "all") params.set("src", sourceFilter);
      const qs = params.toString();
      router.replace(qs ? `/cataloghi?${qs}` : "/cataloghi", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, sort, sourceFilter, router]);

  // Keyboard shortcuts
  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  const openNewDialog = useCallback(() => setDialogOpen(true), []);
  const clearOrBlur = useCallback(() => {
    if (query) setQuery("");
    else searchInputRef.current?.blur();
  }, [query]);

  useSearchKeyboard({
    onFocusSearch: focusSearch,
    onEscape: clearOrBlur,
    onAdd: openNewDialog,
    onShowHelp: () => setHelpOpen(true),
  });

  // `N` = new catalog (custom; not covered by useSearchKeyboard)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Empty state (no catalogs at all)
  if (initialCatalogs.length === 0) {
    return (
      <div className="p-6">
        <header className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
            Cataloghi fornitori
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">
            Listini e prezzi
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Inserisci i listini dei tuoi fornitori e confrontali.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface-card p-12 text-center">
          <h2 className="text-lg font-medium text-text-primary">
            Nessun catalogo ancora
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Crea il primo listino per iniziare a confrontare i prezzi.
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-green px-4 py-2 font-medium text-surface-base"
          >
            <Plus className="h-4 w-4" /> Nuovo catalogo
          </button>
        </div>

        <CatalogFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSaved={(c) => {
            if (c) router.push(`/cataloghi/${c.id}`);
            else router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <CatalogGalleryHeader
        ref={searchInputRef}
        stats={stats}
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        sourceCounts={sourceCounts}
        onNewCatalog={() => setDialogOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        canCompare={canCompare}
        filteredCount={sorted.length}
      />

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-surface-card p-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
            Nessun catalogo trovato
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {query
              ? <>Nessun fornitore corrisponde a &ldquo;{query}&rdquo;.</>
              : "Nessun catalogo con i filtri attivi."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSourceFilter("all");
            }}
            className="mt-3 font-mono text-[11px] uppercase tracking-wide text-accent-green hover:underline"
          >
            Pulisci filtri
          </button>
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
          }}
        >
          {sorted.map((c) => {
            const cardData: CatalogStackCardData = {
              id: c.id,
              supplierName: c.supplier_name,
              deliveryDays: c.delivery_days,
              minOrderAmount: c.min_order_amount,
              notes: c.notes,
              updatedAt: c.updated_at,
              source: c.source,
              aggregates: c.aggregates,
            };
            return (
              <CatalogStackCard key={`${c.source}-${c.id}`} catalog={cardData} />
            );
          })}
        </div>
      )}

      <footer className="pt-2 text-right font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
        Suggerimento: premi{" "}
        <kbd className="rounded border border-border-subtle px-1 py-0.5 text-text-secondary">
          /
        </kbd>{" "}
        per cercare,{" "}
        <kbd className="rounded border border-border-subtle px-1 py-0.5 text-text-secondary">
          N
        </kbd>{" "}
        per un nuovo catalogo,{" "}
        <kbd className="rounded border border-border-subtle px-1 py-0.5 text-text-secondary">
          ?
        </kbd>{" "}
        per le scorciatoie.
      </footer>

      <CatalogFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(c) => {
          if (c) router.push(`/cataloghi/${c.id}`);
          else router.refresh();
        }}
      />

      <CheatsheetOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}

/** Backwards-compat type export — kept in case anything imports it. */
export type Catalog = EnrichedCatalog;
