// app/(app)/fornitori/_components/supplier-list.tsx
"use client";

import { SupplierRow } from "./supplier-row";
import type { RelationshipRow, SortMode } from "../_lib/types";

const SORT_LABELS: Record<SortMode, string> = {
  recent: "recenti",
  name: "nome",
  rating: "rating",
};

export function SupplierList({
  relationships,
  selectedId,
  onSelect,
  sort,
  onSortChange,
}: {
  relationships: RelationshipRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
}) {
  if (relationships.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <div className="space-y-2 font-mono text-[12px] text-text-tertiary">
          <p className="uppercase tracking-[0.1em]">nessun fornitore</p>
          <p className="text-[11px]">try: clear filters · broader query</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span>{relationships.length} fornitori</span>
        <div className="flex items-center gap-2">
          <span>sort</span>
          {(["recent", "name", "rating"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onSortChange(m)}
              className={`rounded px-1.5 py-0.5 ${
                sort === m
                  ? "bg-accent-green/10 text-accent-green"
                  : "hover:text-text-primary"
              }`}
            >
              {SORT_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div
        id="fornitori-listbox"
        className="min-h-0 flex-1 overflow-y-auto"
        role="listbox"
        aria-label="Lista fornitori"
      >
        {relationships.map((rel, i) => (
          <SupplierRow
            key={rel.id}
            rel={rel}
            index={i}
            selected={rel.id === selectedId}
            onSelect={() => onSelect(rel.id)}
          />
        ))}
      </div>
    </div>
  );
}
