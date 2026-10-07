// Is the detected supplier one the restaurant already has a list for?

import type { SupplierInfo } from "../types.ts";
import { supplierNameKey } from "../parse/supplier-info.ts";
import { similarity } from "./similarity.ts";

export type CatalogRef = { id: string; supplier_name: string; notes: string | null };

export type CatalogCandidate = {
  catalogId: string;
  supplierName: string;
  score: number;
  reason: string;
};

const PIVA_IN_TEXT = /(?<!\d)(\d{11})(?!\d)/g;

/** P.IVA numbers stored in free text (catalog notes written by previous imports). */
export function vatNumbersIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(PIVA_IN_TEXT)].map((m) => m[1]!);
}

export function matchSupplierToCatalogs(
  supplier: Pick<SupplierInfo, "name" | "vatNumber">,
  catalogs: CatalogRef[],
  threshold = 0.72,
): CatalogCandidate[] {
  const out: CatalogCandidate[] = [];
  const key = supplier.name ? supplierNameKey(supplier.name) : "";
  for (const c of catalogs) {
    if (supplier.vatNumber && vatNumbersIn(c.notes).includes(supplier.vatNumber)) {
      out.push({ catalogId: c.id, supplierName: c.supplier_name, score: 1, reason: "Stessa partita IVA" });
      continue;
    }
    if (!key) continue;
    const ck = supplierNameKey(c.supplier_name);
    if (!ck) continue;
    const s = ck === key ? 0.97 : similarity(key, ck);
    if (s >= threshold) {
      out.push({
        catalogId: c.id,
        supplierName: c.supplier_name,
        score: Math.round(s * 100) / 100,
        reason: s >= 0.97 ? "Stesso nome" : "Nome simile",
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}
