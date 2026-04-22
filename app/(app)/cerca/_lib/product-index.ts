// app/(app)/cerca/_lib/product-index.ts
import MiniSearch, { type SearchResult } from "minisearch";
import { normalizeName } from "@/lib/catalogs/normalize";
import type { Group } from "./types";

export type IndexedDoc = {
  id: string;            // Group.key
  productName: string;
  unit: string;
  supplierNames: string;
};

export type ProductIndex = MiniSearch<IndexedDoc>;

/** Tokenizer: lowercase + strip diacritics + split on whitespace/punct. */
function tokenize(text: string): string[] {
  return normalizeName(text).split(/\s+/).filter(Boolean);
}

/** Smart fuzzy: disabled for <=3 char tokens (too noisy), gentle for 4-5, strong for 6+. */
function fuzzyFor(term: string): number {
  if (term.length <= 3) return 0;
  if (term.length <= 5) return 0.15;
  return 0.25;
}

export function buildIndex(groups: Group[]): ProductIndex {
  const mini = new MiniSearch<IndexedDoc>({
    fields: ["productName", "unit", "supplierNames"],
    storeFields: ["id"],
    tokenize,
    processTerm: (term) => term.toLowerCase(),
    searchOptions: {
      prefix: true,
      fuzzy: (term) => fuzzyFor(term),
      boost: { productName: 4, supplierNames: 1.5, unit: 1 },
      combineWith: "AND",
    },
  });
  mini.addAll(
    groups.map((g) => ({
      id: g.key,
      productName: g.productName,
      unit: g.unit,
      supplierNames: g.offers.map((o) => o.supplier.supplier_name).join(" "),
    })),
  );
  return mini;
}

/**
 * Returns matching Group keys ordered by score (best first).
 *
 * - Empty query: returns all keys in input order (fresh array).
 * - Multi-token: first try AND (all tokens match), fallback to OR if zero hits —
 *   "pomodoro bio" → matches "pomodoro" if "bio" absent in any name.
 */
export function searchGroups(
  index: ProductIndex,
  groups: Group[],
  query: string,
): string[] {
  const q = query.trim();
  // Always return a fresh array so downstream memos can't accidentally share refs.
  if (!q) return groups.map((g) => g.key);

  const tokens = tokenize(q);
  if (tokens.length === 0) return groups.map((g) => g.key);

  // AND first — precise.
  let res: SearchResult[] = index.search(q, { combineWith: "AND" });

  // Fallback OR when AND starves (common for casual multi-word queries).
  if (res.length === 0 && tokens.length > 1) {
    res = index.search(q, { combineWith: "OR" });
  }

  return res.map((r) => r.id as string);
}
