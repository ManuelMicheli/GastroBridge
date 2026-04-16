/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import type { PriceListRow, PriceListWithProduct } from "./types";

const WITH_PRODUCT = `
  *,
  product:products!product_id (
    id,
    name,
    unit,
    price
  )
`;

/**
 * All price-list entries for a given relationship (supplier or restaurant side — RLS enforces).
 */
export async function getPriceListByRelationship(
  relationshipId: string,
): Promise<PriceListWithProduct[]> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("supplier_price_lists")
    .select(WITH_PRODUCT)
    .eq("relationship_id", relationshipId)
    .order("created_at", { ascending: false }) as { data: PriceListWithProduct[] | null };
  return data ?? [];
}

/**
 * Bulk lookup: map product_id → effective custom price for a relationship.
 * Expired/not-yet-valid entries are filtered out.
 */
export async function getActivePriceMap(
  relationshipId: string,
  productIds: string[],
): Promise<Map<string, PriceListRow>> {
  const out = new Map<string, PriceListRow>();
  if (productIds.length === 0) return out;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await (supabase as any)
    .from("supplier_price_lists")
    .select("*")
    .eq("relationship_id", relationshipId)
    .in("product_id", productIds) as { data: PriceListRow[] | null };

  for (const row of data ?? []) {
    if (row.valid_from && row.valid_from > today) continue;
    if (row.valid_to   && row.valid_to   < today) continue;
    out.set(row.product_id, row);
  }
  return out;
}
