// app/(app)/cerca/_components/results-list.tsx
"use client";

import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
}: {
  groups: Group[];
  query: string;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  isSearching: boolean;
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

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="space-y-2 font-mono text-[12px] text-text-tertiary">
          <p className="uppercase tracking-[0.1em]">no matches</p>
          {query && (
            <p>
              per &quot;<span className="text-text-secondary">{query}</span>&quot;
            </p>
          )}
          <p className="text-[11px]">try: clear filters · broader query</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span>{sorted.length} prodotti</span>
        <div className="flex items-center gap-2">
          <span>sort</span>
          {(["relevance", "price", "name"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onSortChange(m)}
              className={`rounded px-1.5 py-0.5 ${
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
        className={`min-h-0 flex-1 overflow-y-auto transition-opacity duration-150 ${
          isSearching ? "opacity-60" : "opacity-100"
        }`}
        role="listbox"
        aria-label="Risultati ricerca prodotti"
      >
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
