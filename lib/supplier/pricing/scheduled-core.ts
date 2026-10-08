/* eslint-disable @typescript-eslint/no-explicit-any */
// Scheduled price changes — core logic shared by the server actions (user
// client, permission checked by the caller), the lazy apply on the Listini
// page and the cron route (service role). No revalidatePath here: it is also
// called while rendering.

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayKey } from "@/lib/supplier/intel/time";

export type ScheduledChange = {
  id: string;
  supplier_id: string;
  price_list_id: string;
  category_id: string | null;
  mode: "percent" | "fixed";
  value: number;
  effective_date: string;
  status: "scheduled" | "applied" | "canceled";
  note: string | null;
  notify_clients: boolean;
  notified_at: string | null;
  applied_at: string | null;
  applied_count: number | null;
  created_at: string;
};

export function newPrice(price: number, mode: "percent" | "fixed", value: number): number {
  const p = mode === "percent" ? price * (1 + value / 100) : price + value;
  return Math.max(0, Math.round(p * 10000) / 10000);
}

/** Applies one change to its price list. Returns the number of items updated. */
export async function applyScheduledChange(
  client: SupabaseClient<any, any, any>,
  change: Pick<ScheduledChange, "id" | "supplier_id" | "price_list_id" | "category_id" | "mode" | "value">,
): Promise<number> {
  let productIds: string[] | null = null;
  if (change.category_id) {
    const { data: prods } = (await (client as any)
      .from("products")
      .select("id")
      .eq("supplier_id", change.supplier_id)
      .eq("category_id", change.category_id)) as { data: Array<{ id: string }> | null };
    productIds = (prods ?? []).map((p) => p.id);
  }
  let count = 0;
  if (productIds === null || productIds.length > 0) {
    let q = (client as any).from("price_list_items").select("id, price, product_id").eq("price_list_id", change.price_list_id);
    if (productIds) q = q.in("product_id", productIds);
    const { data: items, error } = (await q) as {
      data: Array<{ id: string; price: number }> | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    for (const it of items ?? []) {
      const { error: upErr } = await (client as any)
        .from("price_list_items")
        .update({ price: newPrice(Number(it.price), change.mode, Number(change.value)) })
        .eq("id", it.id);
      if (upErr) throw new Error(upErr.message);
      count++;
    }
  }
  // Mark applied only if still scheduled (idempotent with concurrent runs).
  await (client as any)
    .from("scheduled_price_changes")
    .update({ status: "applied", applied_at: new Date().toISOString(), applied_count: count })
    .eq("id", change.id)
    .eq("status", "scheduled");
  return count;
}

/**
 * Applies every due change (effective_date <= today, Rome). With
 * `supplierId` only that supplier's changes (lazy apply); without it every
 * supplier (cron, service role). Missing table → 0 (migration not applied).
 */
export async function applyDueScheduledChanges(
  client: SupabaseClient<any, any, any>,
  supplierId?: string,
): Promise<{ applied: number; items: number }> {
  let q = (client as any)
    .from("scheduled_price_changes")
    .select("id, supplier_id, price_list_id, category_id, mode, value, effective_date, status")
    .eq("status", "scheduled")
    .lte("effective_date", todayKey())
    .order("effective_date", { ascending: true })
    .limit(200);
  if (supplierId) q = q.eq("supplier_id", supplierId);
  const { data, error } = (await q) as { data: ScheduledChange[] | null; error: unknown };
  if (error || !data) return { applied: 0, items: 0 };
  let items = 0;
  let applied = 0;
  for (const c of data) {
    try {
      items += await applyScheduledChange(client, c);
      applied++;
    } catch (err) {
      console.error("[pricing:scheduled] apply failed", c.id, err);
    }
  }
  return { applied, items };
}
