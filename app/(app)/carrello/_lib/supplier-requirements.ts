"use client";

/**
 * Lookup map: supplierId → { minOrderAmount, leadTimeDays }.
 *
 * Cart items in this app have two flavors of `supplierId`:
 *   - marketplace: row id in `suppliers` table (real supplier).
 *   - catalog: row id in `restaurant_catalogs` table (imported PDF/Excel).
 *
 * Both stores carry `min_order_amount` (and `delivery_days` as lead hint on
 * catalogs). We query both tables in parallel filtered by the set of ids we
 * actually have in the cart; whichever table has a row wins. Missing rows
 * fall back to `{ minOrderAmount: null, leadTimeDays: null }`.
 */

import { createClient } from "@/lib/supabase/client";

export type SupplierRequirements = {
  minOrderAmount: number | null;
  leadTimeDays: number | null;
};

export type SupplierRequirementsMap = Record<string, SupplierRequirements>;

export async function fetchSupplierRequirements(
  supplierIds: string[],
): Promise<SupplierRequirementsMap> {
  const unique = Array.from(new Set(supplierIds.filter(Boolean)));
  if (unique.length === 0) return {};

  const supabase = createClient();

  // UUIDs only — `restaurant_catalogs.id` and `suppliers.id` are both UUIDs.
  // If a supplierId is not a valid uuid (shouldn't happen in practice) it
  // will simply miss both queries and land in the fallback bucket.
  const [marketplace, catalogs] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, min_order_amount")
      .in("id", unique),
    supabase
      .from("restaurant_catalogs")
      .select("id, min_order_amount, delivery_days")
      .in("id", unique),
  ]);

  const map: SupplierRequirementsMap = {};

  if (marketplace.data) {
    for (const row of marketplace.data as Array<{
      id: string;
      min_order_amount: number | null;
    }>) {
      map[row.id] = {
        minOrderAmount: row.min_order_amount,
        leadTimeDays: null,
      };
    }
  }

  if (catalogs.data) {
    for (const row of catalogs.data as Array<{
      id: string;
      min_order_amount: number | null;
      delivery_days: number | null;
    }>) {
      // Catalog row for this id — only set if not already filled by the
      // marketplace query (ids shouldn't collide across tables, but be safe).
      if (!map[row.id]) {
        map[row.id] = {
          minOrderAmount: row.min_order_amount,
          leadTimeDays: row.delivery_days,
        };
      }
    }
  }

  return map;
}

export async function fetchCurrentRestaurant(): Promise<{
  id: string;
  name: string;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle<{ id: string; name: string }>();
  return data ?? null;
}
