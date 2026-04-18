// app/(app)/cataloghi/confronta/_components/compare-supplier-toggle.tsx
//
// Dense terminal-styled supplier chip row. Each chip toggles a supplier in
// or out of the pivot columns. Chips are rounded-md (not pill), mono 11px.
// Active: accent-green tint + checkmark glyph; inactive: subtle border.

"use client";

import { Check } from "lucide-react";
import type { SupplierCol } from "@/lib/catalogs/compare";

type Props = {
  suppliers: SupplierCol[];
  selected: Set<string>;
  onToggle: (id: string) => void;
};

export function CompareSupplierToggle({ suppliers, selected, onToggle }: Props) {
  const total = suppliers.length;
  const active = suppliers.filter((s) => selected.has(s.id)).length;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface-card p-2"
      role="group"
      aria-label="Fornitori visibili"
    >
      <span className="shrink-0 px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Suppliers
      </span>

      <div className="flex flex-wrap gap-1.5 min-w-0">
        {suppliers.map((s) => {
          const isActive = selected.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => onToggle(s.id)}
              className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${
                isActive
                  ? "border-accent-green/40 bg-accent-green/10 text-accent-green"
                  : "border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              }`}
            >
              <Check
                className={`h-3 w-3 ${
                  isActive ? "opacity-100" : "opacity-30"
                }`}
                aria-hidden
              />
              <span className="normal-case">{s.supplier_name}</span>
            </button>
          );
        })}
      </div>

      <span className="ml-auto shrink-0 pr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span className="tabular-nums text-text-secondary">{active}</span>
        <span className="mx-0.5 text-border-subtle">/</span>
        <span className="tabular-nums">{total}</span>
      </span>
    </div>
  );
}
