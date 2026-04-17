// app/(app)/fornitori/_components/supplier-filter-panel.tsx
"use client";

import { X } from "lucide-react";
import { FacetGroup, FacetCheckboxRow } from "@/components/shared/awwwards";
import type { RelationshipStatus } from "@/lib/relationships/types";
import {
  emptyFacets,
  hasActiveFacets,
  type SupplierFacetState,
} from "../_lib/types";

const STATUS_LABELS: Record<RelationshipStatus, string> = {
  pending: "In attesa",
  active: "Attivo",
  paused: "In pausa",
  rejected: "Rifiutato",
  archived: "Archiviato",
};

export type SupplierFacetCounts = {
  statuses: Array<{ value: RelationshipStatus; count: number }>;
  cities: Array<{ value: string; count: number }>;
  certs: Array<{ value: string; count: number }>;
  verifiedCount: number;
};

export function SupplierFilterPanel({
  facets,
  counts,
  onChange,
}: {
  facets: SupplierFacetState;
  counts: SupplierFacetCounts;
  onChange: (next: SupplierFacetState) => void;
}) {
  const active = hasActiveFacets(facets);

  const toggleStatus = (s: RelationshipStatus) => {
    const next = new Set(facets.statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...facets, statuses: next });
  };
  const toggleCity = (c: string) => {
    const next = new Set(facets.cities);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...facets, cities: next });
  };
  const toggleCert = (c: string) => {
    const next = new Set(facets.certs);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange({ ...facets, certs: next });
  };

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
        <FacetGroup label="Status" activeCount={facets.statuses.size}>
          {counts.statuses.length === 0 ? (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          ) : (
            counts.statuses.map((o) => (
              <FacetCheckboxRow
                key={o.value}
                label={STATUS_LABELS[o.value]}
                count={o.count}
                checked={facets.statuses.has(o.value)}
                onToggle={() => toggleStatus(o.value)}
              />
            ))
          )}
        </FacetGroup>

        <FacetGroup label="Verificati" activeCount={facets.verifiedOnly ? 1 : 0}>
          <FacetCheckboxRow
            label="Solo verificati"
            count={counts.verifiedCount}
            checked={facets.verifiedOnly}
            onToggle={() =>
              onChange({ ...facets, verifiedOnly: !facets.verifiedOnly })
            }
          />
        </FacetGroup>

        <FacetGroup label="Città" activeCount={facets.cities.size}>
          {counts.cities.length === 0 ? (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          ) : (
            counts.cities.map((o) => (
              <FacetCheckboxRow
                key={o.value}
                label={o.value}
                count={o.count}
                checked={facets.cities.has(o.value)}
                onToggle={() => toggleCity(o.value)}
              />
            ))
          )}
        </FacetGroup>

        <FacetGroup label="Certificazioni" activeCount={facets.certs.size}>
          {counts.certs.length === 0 ? (
            <p className="px-3 py-1 text-[12px] text-text-tertiary">—</p>
          ) : (
            counts.certs.map((o) => (
              <FacetCheckboxRow
                key={o.value}
                label={o.value}
                count={o.count}
                checked={facets.certs.has(o.value)}
                onToggle={() => toggleCert(o.value)}
              />
            ))
          )}
        </FacetGroup>

        <FacetGroup
          label="Rating minimo"
          activeCount={facets.minRating > 0 ? 1 : 0}
        >
          <RatingSlider
            value={facets.minRating}
            onChange={(n) => onChange({ ...facets, minRating: n })}
          />
        </FacetGroup>
      </div>
    </aside>
  );
}

function RatingSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[11px] tabular-nums text-text-secondary">
        <span>rating ≥ {value.toFixed(1)}</span>
        {value > 0 && (
          <button
            onClick={() => onChange(0)}
            className="font-mono text-[10px] uppercase tracking-wide text-text-tertiary hover:text-text-primary"
          >
            reset
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full appearance-none rounded-full bg-surface-hover accent-[var(--color-accent-green)]"
        aria-label="Rating minimo"
      />
    </div>
  );
}
