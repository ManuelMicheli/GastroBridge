/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/restaurants/context";
import { getPreferences } from "@/lib/restaurants/preferences";
import { bundleToScoringPrefs } from "@/lib/scoring";
import type { Preferences } from "@/lib/scoring";
import { loadConnectedSupplierCatalogs } from "@/lib/catalogs/connected-suppliers";
import { loadUsualOrder } from "./_lib/usual-order";
import { SearchPageClient, type SupplierLite, type CatalogItemLite } from "./search-client";

export const metadata: Metadata = { title: "Cerca Prodotti" };

export default async function SearchPage() {
  const supabase = await createClient();

  // Active restaurant (owner or team member) and its scope (multi-sede).
  const ctx = await getRestaurantContext();
  const restaurantIds: string[] = ctx?.scopeIds ?? [];
  const primary = ctx ? { id: ctx.restaurantId } : null;

  // --- Phase 1: independent reads in parallel (manual catalogs, connected
  //     supplier catalogs). None depend on each other.
  const [catalogsRes, connected] = await Promise.all([
    supabase
      .from("restaurant_catalogs")
      .select("id, supplier_name, delivery_days, min_order_amount")
      .in("restaurant_id", restaurantIds)
      .order("supplier_name", { ascending: true }),
    loadConnectedSupplierCatalogs(restaurantIds),
  ]);

  const catalogs = catalogsRes.data;
  const manualSuppliers: SupplierLite[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days ?? null,
    min_order_amount:
      c.min_order_amount !== null && c.min_order_amount !== undefined
        ? Number(c.min_order_amount)
        : null,
  }));
  const manualSupplierIds = manualSuppliers.map((s) => s.id);

  // --- Phase 2: reads that depend on Phase-1 results, also parallel.
  const [prefResult, manualItemsRes, usualOrder] = await Promise.all([
    primary ? getPreferences(primary.id) : Promise.resolve(null),
    manualSupplierIds.length > 0
      ? supabase
          .from("restaurant_catalog_items")
          .select("id, catalog_id, product_name, product_name_normalized, unit, price, notes")
          .in("catalog_id", manualSupplierIds as any)
      : Promise.resolve({ data: [] as any[] }),
    loadUsualOrder(supabase as any, restaurantIds),
  ]);

  const preferences: Preferences | null = prefResult
    ? bundleToScoringPrefs(prefResult.ok ? prefResult.data : null)
    : null;

  const manualItems: CatalogItemLite[] = (manualItemsRes.data ?? []).map((r: any) => ({
    id:                       r.id,
    catalog_id:               r.catalog_id,
    product_name:             r.product_name,
    product_name_normalized:  r.product_name_normalized,
    unit:                     r.unit,
    price:                    Number(r.price),
    notes:                    r.notes,
  }));

  // --- Fornitori reali collegati (status=active)
  const { suppliers: connectedSuppliers, items: connectedItemsRaw } = connected;

  const connectedItems: CatalogItemLite[] = connectedItemsRaw.map((r) => ({
    id:                      r.id,
    catalog_id:              r.catalog_id,
    product_name:            r.product_name,
    product_name_normalized: r.product_name_normalized,
    unit:                    r.unit,
    price:                   r.price,
    notes:                   r.notes,
  }));

  const suppliers: SupplierLite[] = [...connectedSuppliers, ...manualSuppliers];
  const items: CatalogItemLite[] = [...connectedItems, ...manualItems];

  const connectedSupplierIds = connectedSuppliers.map((s) => s.id);

  return (
    <SearchPageClient
      suppliers={suppliers}
      items={items}
      preferences={preferences}
      connectedSupplierIds={connectedSupplierIds}
      usualOrder={usualOrder}
    />
  );
}
