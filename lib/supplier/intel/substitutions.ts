/* eslint-disable @typescript-eslint/no-explicit-any */
// Substitution suggestions for order lines the supplier cannot fully serve.
//
// Candidates: same supplier, same category, available in catalog, same unit
// of measure (so the requested quantity still makes sense), unit price
// within ±30 % of the original line price, and — when the supplier manages
// stock — enough free stock for the requested quantity. Ranked by same
// subcategory first, then price distance, then stock depth.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SubstituteCandidate = {
  productId: string;
  name: string;
  unit: string;
  price: number;
  /** Free stock (null when the supplier does not manage stock). */
  available: number | null;
  sameSubcategory: boolean;
  priceDeltaPct: number;
};

export type ShortLine = {
  lineId: string;
  productId: string;
  requested: number;
  unitPrice: number;
};

const PRICE_BAND = 0.3;

export async function getSubstituteSuggestions(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  shortLines: ShortLine[],
  { stockTracked, limit = 3 }: { stockTracked: boolean; limit?: number },
): Promise<Record<string, SubstituteCandidate[]>> {
  const out: Record<string, SubstituteCandidate[]> = {};
  if (shortLines.length === 0) return out;

  const originalIds = [...new Set(shortLines.map((l) => l.productId))];
  const { data: originals } = (await (supabase as any)
    .from("products")
    .select("id, category_id, subcategory_id, unit, price")
    .in("id", originalIds)) as {
    data: Array<{ id: string; category_id: string; subcategory_id: string | null; unit: string; price: number }> | null;
  };
  const byId = new Map((originals ?? []).map((p) => [p.id, p]));
  const categories = [...new Set((originals ?? []).map((p) => p.category_id))];
  if (categories.length === 0) return out;

  const { data: pool } = (await (supabase as any)
    .from("products")
    .select("id, name, unit, price, category_id, subcategory_id")
    .eq("supplier_id", supplierId)
    .eq("is_available", true)
    .in("category_id", categories)
    .limit(2000)) as {
    data: Array<{ id: string; name: string; unit: string; price: number; category_id: string; subcategory_id: string | null }> | null;
  };
  const candidates = pool ?? [];

  const stock = new Map<string, number>();
  if (stockTracked && candidates.length > 0) {
    const ids = candidates.map((c) => c.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data: lots } = (await (supabase as any)
        .from("stock_lots")
        .select("product_id, quantity_base, quantity_reserved_base")
        .in("product_id", ids.slice(i, i + 200))) as {
        data: Array<{ product_id: string; quantity_base: number; quantity_reserved_base: number }> | null;
      };
      for (const l of lots ?? []) {
        stock.set(
          l.product_id,
          (stock.get(l.product_id) ?? 0) + Math.max(Number(l.quantity_base) - Number(l.quantity_reserved_base), 0),
        );
      }
    }
  }

  for (const line of shortLines) {
    const orig = byId.get(line.productId);
    if (!orig) continue;
    const refPrice = line.unitPrice > 0 ? line.unitPrice : Number(orig.price);
    const ranked = candidates
      .filter((c) => c.id !== orig.id && c.category_id === orig.category_id && c.unit === orig.unit)
      .map((c) => {
        const price = Number(c.price);
        const delta = refPrice > 0 ? (price - refPrice) / refPrice : 0;
        return {
          productId: c.id,
          name: c.name,
          unit: c.unit,
          price,
          available: stockTracked ? (stock.get(c.id) ?? 0) : null,
          sameSubcategory: !!orig.subcategory_id && c.subcategory_id === orig.subcategory_id,
          priceDeltaPct: Math.round(delta * 1000) / 10,
        };
      })
      .filter((c) => Math.abs(c.priceDeltaPct) <= PRICE_BAND * 100)
      .filter((c) => c.available === null || c.available >= line.requested)
      .sort(
        (a, b) =>
          Number(b.sameSubcategory) - Number(a.sameSubcategory) ||
          Math.abs(a.priceDeltaPct) - Math.abs(b.priceDeltaPct) ||
          (b.available ?? 0) - (a.available ?? 0),
      )
      .slice(0, limit);
    if (ranked.length > 0) out[line.lineId] = ranked;
  }
  return out;
}
