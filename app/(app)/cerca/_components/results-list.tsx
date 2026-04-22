// app/(app)/cerca/_components/results-list.tsx
"use client";

import { useRef, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { ResultRow } from "./result-row";
import type { Group } from "../_lib/types";

export type SortMode = "relevance" | "price" | "name";

export function ResultsList({
  groups,
  query,
  selectedKey,
  onSelect,
  sort,
  onSortChange,
  isSearching,
  hasActiveFacets = false,
  onClearFilters,
}: {
  groups: Group[];
  query: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  isSearching: boolean;
  hasActiveFacets?: boolean;
  onClearFilters?: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => {
    if (sort === "relevance") return groups;
    if (sort === "price") {
      return [...groups].sort(
        (a, b) => (a.offers[0]?.price ?? Infinity) - (b.offers[0]?.price ?? Infinity),
      );
    }
    return [...groups].sort((a, b) => a.productName.localeCompare(b.productName, "it"));
  }, [groups, sort]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 8,
    getItemKey: (i) => sorted[i]?.key ?? i,
  });

  // Reset scroll to top when query changes — avoids blank viewport after filter.
  useEffect(() => {
    if (parentRef.current) parentRef.current.scrollTop = 0;
  }, [query, sort]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="max-w-xs space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-text-tertiary">
            <SearchIcon className="h-4 w-4" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
            nessun risultato
          </p>
          {query && (
            <p className="text-[13px] text-text-secondary">
              per &quot;<span className="text-text-primary">{query}</span>&quot;
            </p>
          )}
          {hasActiveFacets && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <SlidersHorizontal className="h-3 w-3" /> cancella filtri
            </button>
          )}
          {!hasActiveFacets && (
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
              prova query più breve
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span>
          {sorted.length} {sorted.length === 1 ? "prodotto" : "prodotti"}
        </span>
        <div className="flex items-center gap-2">
          <span>sort</span>
          {(["relevance", "price", "name"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onSortChange(m)}
              className={`rounded px-1.5 py-0.5 transition-colors ${
                sort === m
                  ? "bg-accent-green/10 text-accent-green"
                  : "hover:text-text-primary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={parentRef}
        id="search-results-listbox"
        className={`relative min-h-0 flex-1 overflow-y-auto transition-opacity duration-150 ${
          isSearching ? "opacity-70" : "opacity-100"
        }`}
        role="listbox"
        aria-label="Risultati ricerca prodotti"
        aria-busy={isSearching}
      >
        {isSearching && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
            aria-hidden
          >
            <div
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-accent-green/70 to-transparent"
              style={{ animation: "shimmer-sweep 1.2s linear infinite" }}
            />
          </div>
        )}
        <div
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualizer.getVirtualItems().map((v) => {
            const g = sorted[v.index]!;
            return (
              <div
                key={v.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${v.start}px)`,
                }}
              >
                <ResultRow
                  group={g}
                  query={query}
                  selected={g.key === selectedKey}
                  onSelect={() => onSelect(g.key)}
                  index={v.index}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
