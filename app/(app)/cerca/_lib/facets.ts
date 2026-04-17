// app/(app)/cerca/_lib/facets.ts
import type { Group, RankedOffer } from "./types";

export type FacetState = {
  units: Set<string>;
  supplierIds: Set<string>;
  categories: Set<string>;          // macroCategory from offers
  priceRange: [number, number] | null;
  minScore: number;                 // 0..100
  bioOnly: boolean;
  certs: Set<string>;
};

export const emptyFacets = (): FacetState => ({
  units: new Set(),
  supplierIds: new Set(),
  categories: new Set(),
  priceRange: null,
  minScore: 0,
  bioOnly: false,
  certs: new Set(),
});

export function hasActiveFacets(f: FacetState): boolean {
  return (
    f.units.size > 0 ||
    f.supplierIds.size > 0 ||
    f.categories.size > 0 ||
    f.priceRange !== null ||
    f.minScore > 0 ||
    f.bioOnly ||
    f.certs.size > 0
  );
}

// Facet predicates are keyed by facet name so we can exclude the current
// facet when computing its own counts (standard "or all" facet semantics).
type FacetKey = "units" | "suppliers" | "categories" | "price" | "score" | "bio" | "certs";

function matchOne(g: Group, f: FacetState, skip?: FacetKey): boolean {
  const best = g.offers[0];
  if (!best) return false;

  if (skip !== "units" && f.units.size > 0 && !f.units.has(g.unit)) return false;

  if (skip !== "suppliers" && f.supplierIds.size > 0) {
    const ok = g.offers.some((o) => f.supplierIds.has(o.supplier.id));
    if (!ok) return false;
  }

  if (skip !== "categories" && f.categories.size > 0) {
    const ok = g.offers.some((o) =>
      f.categories.has(o.scored.offer.macroCategory ?? "altro"),
    );
    if (!ok) return false;
  }

  if (skip !== "price" && f.priceRange) {
    const [min, max] = f.priceRange;
    if (best.price < min || best.price > max) return false;
  }

  if (skip !== "score" && f.minScore > 0) {
    if (best.scored.score < f.minScore) return false;
  }

  if (skip !== "bio" && f.bioOnly) {
    const ok = g.offers.some((o) => o.scored.offer.isBio);
    if (!ok) return false;
  }

  if (skip !== "certs" && f.certs.size > 0) {
    const ok = g.offers.some((o) =>
      (o.scored.offer.certifications ?? []).some((c: string) => f.certs.has(c)),
    );
    if (!ok) return false;
  }

  return true;
}

export function applyFacets(groups: Group[], f: FacetState): Group[] {
  return groups.filter((g) => matchOne(g, f));
}

export type FacetOption<V = string> = { value: V; count: number; label?: string };

export type FacetCounts = {
  units: FacetOption[];
  suppliers: FacetOption[];
  categories: FacetOption[];
  certs: FacetOption[];
  priceBounds: [number, number];   // min/max across all offers
};

export function computeFacetCounts(all: Group[], f: FacetState): FacetCounts {
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  const units = new Map<string, number>();
  const suppliers = new Map<string, number>();
  const supplierNames = new Map<string, string>();
  const categories = new Map<string, number>();
  const certs = new Map<string, number>();

  let pMin = Number.POSITIVE_INFINITY;
  let pMax = 0;

  for (const g of all) {
    if (matchOne(g, f, "units")) bump(units, g.unit);

    if (matchOne(g, f, "suppliers")) {
      const seen = new Set<string>();
      for (const o of g.offers) {
        if (seen.has(o.supplier.id)) continue;
        seen.add(o.supplier.id);
        bump(suppliers, o.supplier.id);
        supplierNames.set(o.supplier.id, o.supplier.supplier_name);
      }
    }

    if (matchOne(g, f, "categories")) {
      const seen = new Set<string>();
      for (const o of g.offers) {
        const c = o.scored.offer.macroCategory ?? "altro";
        if (seen.has(c)) continue;
        seen.add(c);
        bump(categories, c);
      }
    }

    if (matchOne(g, f, "certs")) {
      const seen = new Set<string>();
      for (const o of g.offers) {
        for (const c of o.scored.offer.certifications ?? []) {
          if (seen.has(c)) continue;
          seen.add(c);
          bump(certs, c);
        }
      }
    }

    const best = g.offers[0];
    if (best) {
      if (best.price < pMin) pMin = best.price;
      if (best.price > pMax) pMax = best.price;
    }
  }

  const toSortedCounts = (m: Map<string, number>): FacetOption[] =>
    Array.from(m, ([value, count]) => ({ value, count })).sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value, "it"),
    );

  return {
    units: toSortedCounts(units),
    suppliers: Array.from(suppliers, ([value, count]) => ({
      value,
      count,
      label: supplierNames.get(value) ?? value,
    })).sort((a, b) => b.count - a.count),
    categories: toSortedCounts(categories),
    certs: toSortedCounts(certs),
    priceBounds: [Number.isFinite(pMin) ? pMin : 0, pMax || 0],
  };
}

export function mergeSearchAndFacets(
  groups: Group[],
  rankedIds: string[],
  facets: FacetState,
): Group[] {
  const idOrder = new Map(rankedIds.map((id, i) => [id, i]));
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const matched: Group[] = [];
  for (const id of rankedIds) {
    const g = byKey.get(id);
    if (g) matched.push(g);
  }
  void idOrder;
  return applyFacets(matched, facets);
}

// Helper for RankedOffer type consumers (avoids unused-import warnings).
export type { Group, RankedOffer };
