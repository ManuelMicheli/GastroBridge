// app/(app)/cerca/_lib/product-index.ts
import MiniSearch from "minisearch";
import { normalizeName } from "@/lib/catalogs/normalize";
import type { Group } from "./types";

export type IndexedDoc = {
  id: string;            // Group.key
  productName: string;
  unit: string;
  supplierNames: string;
};

export type ProductIndex = MiniSearch<IndexedDoc>;

/**
 * Tokenizer: lowercase, strip diacritics, split on whitespace + punctuation.
 * Reuses `normalizeName` for consistency with catalog-item normalization.
 */
function tokenize(text: string): string[] {
  return normalizeName(text).split(/\s+/).filter(Boolean);
}

export function buildIndex(groups: Group[]): ProductIndex {
  const mini = new MiniSearch<IndexedDoc>({
    fields: ["productName", "unit", "supplierNames"],
    storeFields: ["id"],
    tokenize,
    processTerm: (term) => term.toLowerCase(),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { productName: 3, unit: 1 },
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
 * Returns matching Group keys ordered by MiniSearch score (best first).
 * Empty query returns all group keys (preserving input order).
 */
export function searchGroups(
  index: ProductIndex,
  groups: Group[],
  query: string,
): string[] {
  const q = query.trim();
  if (!q) return groups.map((g) => g.key);
  const res = index.search(q);
  return res.map((r) => r.id as string);
}
