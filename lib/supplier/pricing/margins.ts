/* eslint-disable @typescript-eslint/no-explicit-any */
// Margin of each price list item vs. the purchase cost recorded on stock
// loads (carichi): weighted average `cost_per_base` of the lots still in
// stock, else the most recent load with a cost. Converted to the item's sales
// unit with `conversion_to_base`. Items without any recorded cost get null —
// never an estimate.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemMargin = {
  itemId: string;
  productId: string;
  price: number;
  unitCost: number | null;
  marginPct: number | null;
  costBasis: "stock_medio" | "ultimo_carico" | null;
};

export async function getListMargins(
  supabase: SupabaseClient<any, any, any>,
  items: Array<{ id: string; product_id: string; sales_unit_id: string; price: number }>,
): Promise<ItemMargin[]> {
  if (items.length === 0) return [];
  const productIds = [...new Set(items.map((i) => i.product_id))];
  const unitIds = [...new Set(items.map((i) => i.sales_unit_id))];

  const conv = new Map<string, number>();
  const costs = new Map<string, { cost: number; basis: "stock_medio" | "ultimo_carico" }>();
  for (let i = 0; i < unitIds.length; i += 200) {
    const { data } = (await (supabase as any)
      .from("product_sales_units")
      .select("id, conversion_to_base")
      .in("id", unitIds.slice(i, i + 200))) as { data: Array<{ id: string; conversion_to_base: number }> | null };
    for (const u of data ?? []) conv.set(u.id, Number(u.conversion_to_base) || 1);
  }
  for (let i = 0; i < productIds.length; i += 200) {
    const { data } = (await (supabase as any)
      .from("stock_lots")
      .select("product_id, quantity_base, cost_per_base, received_at")
      .in("product_id", productIds.slice(i, i + 200))
      .not("cost_per_base", "is", null)) as {
      data: Array<{ product_id: string; quantity_base: number; cost_per_base: number; received_at: string }> | null;
    };
    const agg = new Map<string, { qty: number; value: number; latest: { at: string; cost: number } | null }>();
    for (const l of data ?? []) {
      const cost = Number(l.cost_per_base);
      if (!(cost > 0)) continue;
      const e = agg.get(l.product_id) ?? { qty: 0, value: 0, latest: null };
      const q = Number(l.quantity_base);
      if (q > 0) {
        e.qty += q;
        e.value += q * cost;
      }
      if (!e.latest || l.received_at > e.latest.at) e.latest = { at: l.received_at, cost };
      agg.set(l.product_id, e);
    }
    for (const [pid, e] of agg) {
      if (e.qty > 0) costs.set(pid, { cost: e.value / e.qty, basis: "stock_medio" });
      else if (e.latest) costs.set(pid, { cost: e.latest.cost, basis: "ultimo_carico" });
    }
  }

  return items.map((it) => {
    const c = costs.get(it.product_id);
    const unitCost = c ? Math.round(c.cost * (conv.get(it.sales_unit_id) ?? 1) * 10000) / 10000 : null;
    const price = Number(it.price);
    return {
      itemId: it.id,
      productId: it.product_id,
      price,
      unitCost,
      marginPct: unitCost !== null && price > 0 ? Math.round(((price - unitCost) / price) * 1000) / 10 : null,
      costBasis: c?.basis ?? null,
    };
  });
}
