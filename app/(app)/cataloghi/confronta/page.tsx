/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompareClient } from "./compare-client";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import type { SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";
import { normalizeName } from "@/lib/catalogs/normalize";
import { getPreferences } from "@/lib/restaurants/preferences";
import { bundleToScoringPrefs } from "@/lib/scoring";
import type { Preferences } from "@/lib/scoring";

export default async function CatalogComparePage() {
  const supabase = await createClient();

  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("id, supplier_name, delivery_days, min_order_amount")
    .order("supplier_name", { ascending: true });

  const suppliers: SupplierCol[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days,
    min_order_amount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
  }));

  if (suppliers.length < 2) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold text-text-primary">Confronto prezzi</h1>
        <p className="text-text-secondary">Servono almeno 2 cataloghi per confrontare.</p>
        <Link href="/cataloghi" className="text-accent-green hover:underline">← Torna ai cataloghi</Link>
      </div>
    );
  }

  const ids = suppliers.map((s) => s.id);
  const { data: items } = await supabase
    .from("restaurant_catalog_items")
    .select("*")
    .in("catalog_id", ids as any);

  const rows: (CatalogItemRow & { catalog_id: string })[] = (items ?? []).map((r: any) => ({
    ...r,
    price: Number(r.price),
  }));

  // Collect the set of product names (normalized) the user has actually ordered.
  // Catalog-based orders store item lines in `notes`; marketplace orders link to
  // `order_items.products.name`. We union both sources.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { data: userRestaurants } = (await supabase
    .from("restaurants")
    .select("id, is_primary, created_at")
    .eq("profile_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })) as {
    data: { id: string; is_primary: boolean | null; created_at: string | null }[] | null;
  };
  const userRestaurantIds = (userRestaurants ?? []).map((r) => r.id);

  const primaryRestaurantId = userRestaurants?.[0]?.id;
  let preferences: Preferences | null = null;
  if (primaryRestaurantId) {
    const prefResult = await getPreferences(primaryRestaurantId);
    preferences = bundleToScoringPrefs(prefResult.ok ? prefResult.data : null);
  }

  const orderedNamesSet = new Set<string>();

  if (userRestaurantIds.length > 0) {
    const { data: recentOrders } = (await supabase
      .from("orders")
      .select("id, notes")
      .in("restaurant_id", userRestaurantIds)
      .order("created_at", { ascending: false })
      .limit(200)) as { data: { id: string; notes: string | null }[] | null };

    for (const o of recentOrders ?? []) {
      if (!o.notes) continue;
      for (const line of o.notes.split(/\r?\n/)) {
        // Lines look like: "  30× Farina 00 (kg) @ 12,80 €". Strip the
        // trailing "(unit)" hint so we match against the bare product name.
        const m = line.match(/^\s{2,}\S+?×\s*(.+?)(?:\s*\([^)]+\))?\s*@\s*.+$/);
        if (m && m[1]) orderedNamesSet.add(normalizeName(m[1]));
      }
    }

    const orderIds = (recentOrders ?? []).map((o) => o.id);
    if (orderIds.length > 0) {
      type MarketplaceItem = { products: { name: string } | null };
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("products(name)")
        .in("order_id", orderIds)
        .returns<MarketplaceItem[]>();
      for (const it of orderItems ?? []) {
        const n = it.products?.name;
        if (n) orderedNamesSet.add(normalizeName(n));
      }
    }
  }

  return (
    <>
      <RealtimeRefresh
        subscriptions={[
          { table: "restaurant_catalogs" },
          { table: "restaurant_catalog_items" },
          { table: "orders" },
        ]}
      />
      <CompareClient
        suppliers={suppliers}
        items={rows}
        orderedNormalizedNames={Array.from(orderedNamesSet)}
        preferences={preferences}
      />
    </>
  );
}
