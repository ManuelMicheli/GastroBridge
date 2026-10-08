// Client-side review state for the smart import (pure helpers).

import type { ExtractedProduct, PackInfo, SaleUnit } from "@/lib/import/types";
import { REVIEW_THRESHOLD } from "@/lib/import/types";
import type { ImportCategory } from "@/lib/import/lexicon/categories";
import type { Correction } from "@/lib/import/memory";
import { computeUnitPrice } from "@/lib/import/parse/units";

export type ReviewItem = {
  id: string;
  sourceKey: string;
  original: string;
  included: boolean;
  /** User changed something on this row. */
  edited: boolean;
  /** User explicitly looked at / accepted a flagged row. */
  accepted: boolean;
  name: string;
  price: number | null;
  priceUnit: SaleUnit;
  category: ImportCategory;
  format: string | null;
  pack: PackInfo;
  code: string | null;
  brand: string | null;
  vatRate: number | null;
  availability: string | null;
  available: boolean;
  origin: string | null;
  minQty: ExtractedProduct["minQty"];
  confidence: number;
  fieldConfidence: ExtractedProduct["confidence"];
  issues: string[];
  fromMemory: boolean;
  extracted: { name: string; priceUnit: SaleUnit; category: ImportCategory; price: number | null };
};

export function toReviewItems(products: ExtractedProduct[]): ReviewItem[] {
  return products.map((p) => ({
    id: p.id,
    sourceKey: p.sourceKey,
    original: p.original,
    included: p.price !== null && p.price > 0,
    edited: false,
    accepted: false,
    name: p.name,
    price: p.price,
    priceUnit: p.priceUnit,
    category: p.category,
    format: p.format,
    pack: p.pack,
    code: p.code,
    brand: p.brand,
    vatRate: p.vatRate,
    availability: p.availability,
    available: p.available,
    origin: p.origin,
    minQty: p.minQty,
    confidence: p.confidence.overall,
    fieldConfidence: p.confidence,
    issues: p.issues,
    fromMemory: p.fromMemory,
    extracted: { name: p.name, priceUnit: p.priceUnit, category: p.category, price: p.price },
  }));
}

export function needsReview(i: ReviewItem): boolean {
  return !i.accepted && !i.edited && (i.confidence < REVIEW_THRESHOLD || i.price === null);
}

export function unitPriceOf(i: Pick<ReviewItem, "price" | "priceUnit" | "pack">) {
  return i.price !== null ? computeUnitPrice(i.price, i.priceUnit, i.pack) : null;
}

export type ConfidenceTone = "success" | "warning" | "danger";

export function confidenceTone(score: number): ConfidenceTone {
  if (score >= 0.85) return "success";
  if (score >= REVIEW_THRESHOLD) return "warning";
  return "danger";
}

export function confidenceLabel(score: number): string {
  if (score >= 0.85) return "Sicuro";
  if (score >= REVIEW_THRESHOLD) return "Da verificare";
  return "Controlla";
}

/** What the memory should learn: only rows the user changed or removed. */
export function toCorrections(items: ReviewItem[]): Correction[] {
  const out: Correction[] = [];
  for (const i of items) {
    const removed = !i.included && i.extracted.price !== null;
    const changed =
      i.name.trim() !== i.extracted.name || i.priceUnit !== i.extracted.priceUnit || i.category !== i.extracted.category;
    if (!removed && !changed) continue;
    out.push({
      sourceKey: i.sourceKey,
      original: i.original.slice(0, 1000),
      before: { name: i.extracted.name.slice(0, 200), priceUnit: i.extracted.priceUnit, category: i.extracted.category },
      after: { name: i.name.trim().slice(0, 200) || i.extracted.name.slice(0, 200), priceUnit: i.priceUnit, category: i.category },
      removed: removed || undefined,
    });
  }
  return out;
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 3 : 2 });
}

/** "3,20" / "3.2" / "€ 3,20" → 3.2 */
export function parsePriceInput(s: string): number | null {
  const t = s.replace(/[€\s]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10000) / 10000 : null;
}
