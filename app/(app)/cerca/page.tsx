/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/restaurants/preferences";
import { bundleToScoringPrefs } from "@/lib/scoring";
import type { Preferences } from "@/lib/scoring";
import { loadConnectedSupplierCatalogs } from "@/lib/catalogs/connected-suppliers";
import { SearchPageClient, type SupplierLite, type CatalogItemLite } from "./search-client";

export const metadata: Metadata = { title: "Cerca Prodotti" };

export default async function SearchPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  let preferences: Preferences | null = null;
  if (user) {
    const { data: restaurants } = await supabase
      .from("restaurants")
      .select("id")
      .eq("profile_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<{ id: string }[]>();
    const primary = restaurants?.[0];
    if (primary) {
      const prefResult = await getPreferences(primary.id);
      preferences = bundleToScoringPrefs(prefResult.ok ? prefResult.data : null);
    }
  }

  // --- Cataloghi manuali del ristoratore
  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("id, supplier_name, delivery_days, min_order_amount")
    .order("supplier_name", { ascending: true });

  const manualSuppliers: SupplierLite[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days ?? null,
    min_order_amount:
      c.min_order_amount !== null && c.min_order_amount !== undefined
        ? Number(c.min_order_amount)
        : null,
  }));

  let manualItems: CatalogItemLite[] = [];
  if (manualSuppliers.length > 0) {
    const ids = manualSuppliers.map((s) => s.id);
    const { data } = await supabase
      .from("restaurant_catalog_items")
      .select("id, catalog_id, product_name, product_name_normalized, unit, price, notes")
      .in("catalog_id", ids as any);
    manualItems = (data ?? []).map((r: any) => ({
      id:                       r.id,
      catalog_id:               r.catalog_id,
      product_name:             r.product_name,
      product_name_normalized:  r.product_name_normalized,
      unit:                     r.unit,
      price:                    Number(r.price),
      notes:                    r.notes,
    }));
  }

  // --- Fornitori reali collegati (status=active)
  const { suppliers: connectedSuppliers, items: connectedItemsRaw } =
    await loadConnectedSupplierCatalogs(userId);

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

  return (
    <SearchPageClient
      suppliers={suppliers}
      items={items}
      preferences={preferences}
    />
  );
}
