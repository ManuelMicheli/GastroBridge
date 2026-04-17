// app/(app)/cerca/_components/facet-panel.tsx
"use client";

import { X } from "lucide-react";
import { FacetGroup, FacetCheckboxRow } from "./facet-group";
import { PriceRange, ScoreSlider } from "./facet-range";
import type { FacetState, FacetCounts } from "../_lib/facets";
import { hasActiveFacets, emptyFacets } from "../_lib/facets";

const CATEGORY_LABELS: Record<string, string> = {
  carne: "Carne",
  pesce: "Pesce",
  latticini: "Latticini",
  ortofrutta: "Ortofrutta",
  farine_cereali: "Farine e cereali",
  bevande: "Bevande",
  secco: "Secco",
  surgelati: "Surgelati",
  altro: "Altro",
};

export function FacetPanel({
  facets,
  counts,
  onChange,
}: {
  facets: FacetState;
  counts: FacetCounts;
  onChange: (next: FacetState) => void;
}) {
  const toggleSet = (key: keyof FacetState & ("units" | "supplierIds" | "categories" | "certs"), v: string) => {
    const next = new Set(facets[key] as Set<string>);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange({ ...facets, [key]: next });
  };

  const active = hasActiveFacets(facets);

  return (
    <aside className="flex h-full flex-col border-r border-border-subtle bg-surface-card">
      <header className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
          Filtri
        </h2>
        {active && (
          <button
            onClick={() => onChange(emptyFacets())}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
          >
            <X className="h-3 w-3" /> clear all
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FacetGroup label="Unità" activeCount={facets.units.size}>
          {counts.units.length === 0 && (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          )}
          {counts.units.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={o.value}
              count={o.count}
              checked={facets.units.has(o.value)}
              onToggle={() => toggleSet("units", o.value)}
            />
          ))}
        </FacetGroup>

        <FacetGroup label="Fornitori" activeCount={facets.supplierIds.size}>
          {counts.suppliers.length === 0 && (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          )}
          {counts.suppliers.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={o.label ?? o.value}
              count={o.count}
              checked={facets.supplierIds.has(o.value)}
              onToggle={() => toggleSet("supplierIds", o.value)}
            />
          ))}
        </FacetGroup>

        <FacetGroup label="Categoria" activeCount={facets.categories.size}>
          {counts.categories.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={CATEGORY_LABELS[o.value] ?? o.value}
              count={o.count}
              checked={facets.categories.has(o.value)}
              onToggle={() => toggleSet("categories", o.value)}
            />
          ))}
        </FacetGroup>

        <FacetGroup label="Prezzo" activeCount={facets.priceRange ? 1 : 0}>
          <PriceRange
            min={counts.priceBounds[0]}
            max={counts.priceBounds[1]}
            value={facets.priceRange}
            onChange={(next) => onChange({ ...facets, priceRange: next })}
          />
        </FacetGroup>

        <FacetGroup label="Score minimo" activeCount={facets.minScore > 0 ? 1 : 0}>
          <ScoreSlider
            value={facets.minScore}
            onChange={(n) => onChange({ ...facets, minScore: n })}
          />
        </FacetGroup>

        <FacetGroup label="Etichette" activeCount={(facets.bioOnly ? 1 : 0) + facets.certs.size}>
          <FacetCheckboxRow
            label="Solo Bio"
            count={0}
            checked={facets.bioOnly}
            onToggle={() => onChange({ ...facets, bioOnly: !facets.bioOnly })}
          />
          {counts.certs.map((o) => (
            <FacetCheckboxRow
              key={o.value}
              label={o.value}
              count={o.count}
              checked={facets.certs.has(o.value)}
              onToggle={() => toggleSet("certs", o.value)}
            />
          ))}
        </FacetGroup>
      </div>
    </aside>
  );
}
