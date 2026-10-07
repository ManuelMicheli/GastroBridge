// Merge duplicate products inside one import.

import type { ExtractedProduct } from "../types.ts";
import { nameKey } from "../text.ts";
import { formatEuro } from "../parse/numbers.ts";

export function productKey(p: Pick<ExtractedProduct, "name" | "format" | "priceUnit">): string {
  return `${nameKey(p.name)}|${nameKey(p.format ?? "")}|${p.priceUnit}`;
}

/**
 * Keep one product per (name, format, price unit). The most confident row
 * wins; a different price on the duplicate becomes an issue.
 */
export function dedupeProducts(products: ExtractedProduct[]): { products: ExtractedProduct[]; merged: number } {
  const byKey = new Map<string, ExtractedProduct>();
  const order: string[] = [];
  let merged = 0;
  for (const p of products) {
    const k = productKey(p);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, p);
      order.push(k);
      continue;
    }
    merged++;
    const [keep, drop] = p.confidence.overall > prev.confidence.overall ? [p, prev] : [prev, p];
    const issues = [...keep.issues];
    if (drop.price !== null && keep.price !== null && Math.abs(drop.price - keep.price) > 0.005) {
      issues.push(`Riga duplicata con prezzo diverso (${formatEuro(drop.price)}): tenuto ${formatEuro(keep.price)}`);
    }
    byKey.set(k, { ...keep, issues, mergedCount: keep.mergedCount + drop.mergedCount + 1 });
  }
  return { products: order.map((k) => byKey.get(k)!), merged };
}
