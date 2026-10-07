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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { GitCompareArrows, Plus, Search, X } from "lucide-react";
import { CheatsheetOverlay, useSearchKeyboard } from "@/components/shared/awwwards";
import { CatalogFormDialog } from "@/components/dashboard/restaurant/catalog-form-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Chips } from "@/components/fernly/chips";
import type { CatalogRow } from "@/lib/catalogs/types";
import type { CatalogAggregates } from "./_lib/aggregates";
import { SupplierCard, dominantCategory } from "./_components/supplier-card";
import { SupplierDrawer } from "./_components/supplier-drawer";

export type CatalogSource = "manual" | "connected";

export type EnrichedCatalog = CatalogRow & {
  source: CatalogSource;
  aggregates: CatalogAggregates;
};

export type SourceFilter = "all" | "manual" | "connected";
export type SortMode = "updated" | "name" | "items";

const VALID_SORTS: readonly SortMode[] = ["updated", "name", "items"];
const VALID_SOURCES: readonly SourceFilter[] = ["all", "manual", "connected"];
const OWN_PARAMS = ["q", "sort", "src", "cat"] as const;

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Suppliers / catalogs gallery — Fernly "Team" page: category filter chips
 * with FLIP reflow, supplier cards and a profile side drawer. Search (/),
 * new catalog (N), help (?), sort and source filters are unchanged and stay
 * in the URL (q, sort, src, cat).
 */
export function CatalogsClient({
  initialCatalogs,
}: {
  initialCatalogs: EnrichedCatalog[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const onSuppliersPage = pathname.startsWith("/fornitori");

  const initial = useMemo(() => {
    const params = new URLSearchParams(sp.toString());
    const q = params.get("q") ?? "";
    const s = params.get("sort");
    const sort: SortMode =
      s && (VALID_SORTS as readonly string[]).includes(s) ? (s as SortMode) : "updated";
    const src = params.get("src");
    const source: SourceFilter =
      src && (VALID_SOURCES as readonly string[]).includes(src) ? (src as SourceFilter) : "all";
    return { q, sort, source, cat: params.get("cat") ?? "all" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [query, setQuery] = useState(initial.q);
  const [sort, setSort] = useState<SortMode>(initial.sort);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initial.source);
  const [category, setCategory] = useState<string>(initial.cat);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const canCompare = initialCatalogs.length >= 2;

  const sourceCounts = useMemo(() => {
    let manual = 0;
    let connected = 0;
    for (const c of initialCatalogs) {
      if (c.source === "connected") connected += 1;
      else manual += 1;
    }
    return { all: initialCatalogs.length, manual, connected };
  }, [initialCatalogs]);

  // Category chips: dominant macro category of each catalog.
  const categoryOptions = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const c of initialCatalogs) {
      const d = dominantCategory(c);
      if (!d) continue;
      const cur = m.get(d.key) ?? { label: d.label, count: 0 };
      cur.count += 1;
      m.set(d.key, cur);
    }
    return [...m.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([value, v]) => ({ value, label: v.label, count: v.count }));
  }, [initialCatalogs]);

  const filtered = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return initialCatalogs.filter((c) => {
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (category !== "all" && dominantCategory(c)?.key !== category) return false;
      if (q && !normalize(c.supplier_name).includes(q)) return false;
      return true;
    });
  }, [initialCatalogs, deferredQuery, sourceFilter, category]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "name") list.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name, "it"));
    else if (sort === "items") list.sort((a, b) => b.aggregates.itemCount - a.aggregates.itemCount);
    else list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [filtered, sort]);

  const maxItems = useMemo(
    () => initialCatalogs.reduce((m, c) => Math.max(m, c.aggregates.itemCount), 0),
    [initialCatalogs],
  );
  const totalItems = useMemo(
    () => initialCatalogs.reduce((s, c) => s + c.aggregates.itemCount, 0),
    [initialCatalogs],
  );

  // URL sync (debounced 300ms) on the current page — other params are kept.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      for (const k of OWN_PARAMS) params.delete(k);
      if (query) params.set("q", query);
      if (sort !== "updated") params.set("sort", sort);
      if (sourceFilter !== "all") params.set("src", sourceFilter);
      if (category !== "all") params.set("cat", category);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, sort, sourceFilter, category, router, pathname]);

  const focusSearch = useCallback(() => searchInputRef.current?.focus(), []);
  const openNewDialog = useCallback(() => setDialogOpen(true), []);
  const clearOrBlur = useCallback(() => {
    if (profileId) setProfileId(null);
    else if (query) setQuery("");
    else searchInputRef.current?.blur();
  }, [query, profileId]);

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

  const profile = profileId ? initialCatalogs.find((c) => `${c.source}-${c.id}` === profileId) ?? null : null;

  const header = (
    <PageHeader
      title={onSuppliersPage ? "Fornitori" : "Cataloghi"}
      subtitle={
        onSuppliersPage
          ? "I listini dei tuoi fornitori: prezzi, consegne e ordini minimi."
          : "Inserisci i listini dei tuoi fornitori e confrontali."
      }
      actions={
        <>
          <button type="button" onClick={() => setDialogOpen(true)} className="f-btn f-btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.2} /> Nuovo catalogo
          </button>
          {canCompare ? (
            <Link href="/cataloghi/confronta" className="f-btn f-btn-outline">
              <GitCompareArrows className="h-4 w-4" /> Confronta prezzi
            </Link>
          ) : null}
        </>
      }
    />
  );

  const dialog = (
    <CatalogFormDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSaved={(c) => {
        if (c) router.push(`/cataloghi/${c.id}`);
        else router.refresh();
      }}
    />
  );

  if (initialCatalogs.length === 0) {
    return (
      <div className="px-1 pt-3 lg:px-0 lg:pt-0">
        {header}
        <div className="f-card f-rise flex flex-col items-center px-6 py-14 text-center">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--f-ink)]">Nessun catalogo ancora</h2>
          <p className="mt-1.5 max-w-sm text-[14px] text-[var(--f-muted)]">
            Crea il primo listino per iniziare a confrontare i prezzi dei tuoi fornitori.
          </p>
          <button type="button" onClick={() => setDialogOpen(true)} className="f-btn f-btn-primary mt-5">
            <Plus className="h-4 w-4" /> Nuovo catalogo
          </button>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="px-1 pt-3 lg:px-0 lg:pt-0">
      {header}

      {/* Toolbar: category chips · count · search · sort */}
      <div className="f-fade mb-5 flex flex-wrap items-center justify-between gap-3" style={{ ["--d" as string]: "100ms" }}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Chips
            ariaLabel="Filtra per categoria"
            value={category}
            onChange={setCategory}
            options={[{ value: "all", label: "Tutti" }, ...categoryOptions.map((o) => ({ value: o.value, label: o.label }))]}
          />
          {sourceCounts.connected > 0 ? (
            <Chips
              size="sm"
              ariaLabel="Filtra per origine"
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: "all", label: "Tutte le origini", count: sourceCounts.all },
                { value: "manual", label: "Manuali", count: sourceCounts.manual },
                { value: "connected", label: "Piattaforma", count: sourceCounts.connected },
              ]}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12.5px] text-[var(--f-muted)] tabular-nums">
            {sorted.length} fornitor{sorted.length === 1 ? "e" : "i"} · {totalItems} prodotti
          </span>
          <label className="relative flex h-10 w-full items-center sm:w-[240px]">
            <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--f-muted)]" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca fornitore"
              aria-label="Cerca fornitore"
              className="h-10 w-full rounded-full border border-[var(--f-line)] bg-[var(--f-card)] pl-10 pr-9 text-[13.5px] text-[var(--f-ink)] outline-none placeholder:text-[var(--f-faint)] focus:border-[color:color-mix(in_oklab,var(--acc-600)_50%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc-600)_14%,transparent)]"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Pulisci ricerca" className="absolute right-2.5 rounded-full p-1 text-[var(--f-muted)] hover:bg-[var(--f-fill)]">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <Chips
            size="sm"
            ariaLabel="Ordina"
            value={sort}
            onChange={setSort}
            options={[
              { value: "updated", label: "Recenti" },
              { value: "name", label: "Nome" },
              { value: "items", label: "Prodotti" },
            ]}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="f-card flex flex-col items-center px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-[var(--f-ink)]">Nessun fornitore trovato</p>
          <p className="mt-1 text-[13.5px] text-[var(--f-muted)]">
            {query ? <>Nessun fornitore corrisponde a &ldquo;{query}&rdquo;.</> : "Nessun fornitore con i filtri attivi."}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSourceFilter("all");
              setCategory("all");
            }}
            className="f-btn f-btn-sm f-btn-outline mt-4"
          >
            Pulisci filtri
          </button>
        </div>
      ) : (
        <div
          className="grid gap-3 lg:gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 236px), 1fr))" }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {sorted.map((c) => (
              <SupplierCard
                key={`${c.source}-${c.id}`}
                catalog={c}
                maxItems={maxItems}
                onProfile={() => setProfileId(`${c.source}-${c.id}`)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <footer className="pt-6 text-right text-[11.5px] text-[var(--f-faint)]">
        Suggerimento: premi <kbd className="rounded-md bg-[var(--f-fill-2)] px-1.5 py-0.5 text-[var(--f-ink-2)]">/</kbd> per cercare,{" "}
        <kbd className="rounded-md bg-[var(--f-fill-2)] px-1.5 py-0.5 text-[var(--f-ink-2)]">N</kbd> per un nuovo catalogo,{" "}
        <kbd className="rounded-md bg-[var(--f-fill-2)] px-1.5 py-0.5 text-[var(--f-ink-2)]">?</kbd> per le scorciatoie.
      </footer>

      <SupplierDrawer catalog={profile} onClose={() => setProfileId(null)} canCompare={canCompare} />
      {dialog}
      <CheatsheetOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/** Backwards-compat type export — kept in case anything imports it. */
export type Catalog = EnrichedCatalog;
