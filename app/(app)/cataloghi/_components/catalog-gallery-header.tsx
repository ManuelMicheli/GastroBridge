// app/(app)/cataloghi/_components/catalog-gallery-header.tsx
"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { GitCompareArrows, Keyboard, Plus, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatters";

export type SortMode = "updated" | "name" | "items";
export type SourceFilter = "all" | "manual" | "connected";

export type GalleryStats = {
  catalogCount: number;
  totalItems: number;
  avgBasket: number | null;
  updatedTodayCount: number;
};

export type SourceCounts = {
  all: number;
  manual: number;
  connected: number;
};

type Props = {
  stats: GalleryStats;
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (s: SourceFilter) => void;
  sourceCounts: SourceCounts;
  onNewCatalog: () => void;
  onOpenHelp: () => void;
  canCompare: boolean;
  filteredCount: number;
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "updated", label: "aggiornato" },
  { value: "name", label: "nome" },
  { value: "items", label: "prodotti" },
];

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "tutti" },
  { value: "manual", label: "manuali" },
  { value: "connected", label: "da piattaforma" },
];

export const CatalogGalleryHeader = forwardRef<HTMLInputElement, Props>(
  function CatalogGalleryHeader(
    {
      stats,
      query,
      onQueryChange,
      sort,
      onSortChange,
      sourceFilter,
      onSourceFilterChange,
      sourceCounts,
      onNewCatalog,
      onOpenHelp,
      canCompare,
      filteredCount,
    },
    searchRef,
  ) {
    const { catalogCount, totalItems, avgBasket, updatedTodayCount } = stats;

    return (
      <header className="space-y-4 border-b border-border-subtle pb-4">
        {/* Top row: title, stats, actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 w-full lg:w-auto">
            {/* Mobile editorial hero */}
            <div className="lg:hidden">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
                Cataloghi fornitori · {catalogCount} listini
              </div>
              <h1
                className="mt-2 font-serif text-[length:var(--text-display-lg)] font-medium leading-[1.04] tracking-[-0.022em] text-[color:var(--color-text-primary)]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Listini e prezzi
              </h1>
              <p className="mt-1 text-[13px] text-[color:var(--text-muted-light,#6B6B6B)]">
                Inserisci i listini dei tuoi fornitori e confrontali
              </p>
            </div>

            {/* Desktop header */}
            <div className="hidden lg:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                Cataloghi fornitori
                <span className="mx-2 text-border-subtle">·</span>
                <span className="tabular-nums text-text-secondary">
                  {catalogCount} listini
                </span>
                {updatedTodayCount > 0 && (
                  <>
                    <span className="mx-2 text-border-subtle">·</span>
                    <span className="tabular-nums text-accent-green">
                      {updatedTodayCount} aggiornat{updatedTodayCount === 1 ? "o" : "i"} oggi
                    </span>
                  </>
                )}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-text-primary">
                Listini e prezzi
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Inserisci i listini dei tuoi fornitori e confrontali.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Stats chips (desktop) */}
            <p className="hidden font-mono text-[11px] tabular-nums text-text-tertiary md:block">
              <span className="text-text-primary">{catalogCount}</span> cataloghi
              <span className="mx-2 text-border-subtle">·</span>
              <span className="text-text-primary">{totalItems.toLocaleString("it-IT")}</span>{" "}
              prodotti
              {avgBasket !== null && (
                <>
                  <span className="mx-2 text-border-subtle">·</span>
                  <span className="text-text-primary">{formatCurrency(avgBasket)}</span>{" "}
                  basket medio
                </>
              )}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenHelp}
                className="hidden items-center gap-1 rounded-lg border border-border-subtle px-2 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:bg-surface-hover md:inline-flex"
                title="Scorciatoie (?)"
                aria-label="Scorciatoie"
              >
                <Keyboard className="h-3.5 w-3.5" /> ?
              </button>
              <Link
                href="/cataloghi/confronta"
                aria-disabled={!canCompare}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-sm text-text-primary ${
                  canCompare
                    ? "hover:bg-surface-hover"
                    : "opacity-40 pointer-events-none"
                }`}
                title={canCompare ? "" : "Servono almeno 2 cataloghi"}
              >
                <GitCompareArrows className="h-4 w-4" /> Confronta tutti
              </Link>
              <button
                type="button"
                onClick={onNewCatalog}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-green px-3 py-1.5 text-sm font-medium text-surface-base hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Nuovo
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex min-w-0 flex-1 items-center">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 h-4 w-4 text-text-tertiary"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Filtra per fornitore..."
              aria-label="Filtra per fornitore"
              className="h-9 w-full rounded-lg border border-border-subtle bg-surface-card pl-9 pr-20 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-green/40 focus:outline-none focus:ring-1 focus:ring-accent-green/30"
            />
            <span className="pointer-events-none absolute right-3 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
              <span className="tabular-nums text-text-secondary">
                {filteredCount}
              </span>
              /{catalogCount}
            </span>
          </div>

          <div
            className="flex shrink-0 items-center gap-1 rounded-lg border border-border-subtle p-0.5"
            role="radiogroup"
            aria-label="Ordina"
          >
            <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
              sort
            </span>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSortChange(opt.value)}
                  className={`rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                    active
                      ? "bg-accent-green/15 text-accent-green"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Source filter chips */}
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg border border-border-subtle p-0.5"
          role="radiogroup"
          aria-label="Filtra per origine"
        >
          <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
            src
          </span>
          {SOURCE_OPTIONS.map((opt) => {
            const active = sourceFilter === opt.value;
            const count = sourceCounts[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSourceFilterChange(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-accent-green/15 text-accent-green"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`tabular-nums ${
                    active ? "text-accent-green" : "text-text-tertiary"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>
    );
  },
);
