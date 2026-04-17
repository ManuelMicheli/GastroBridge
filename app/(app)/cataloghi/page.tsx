/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { CatalogsClient, type EnrichedCatalog } from "./catalogs-client";
import { computeAggregates, type CatalogItemLite } from "./_lib/aggregates";

export default async function CatalogsPage() {
  const supabase = await createClient();

  // Fetch catalogs + all their items in a single join. Volume is low (<50 catalogs,
  // a few thousand items max), so server-side in-memory aggregation is fine.
  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select(
      "id, restaurant_id, supplier_name, delivery_days, min_order_amount, notes, created_at, updated_at, items:restaurant_catalog_items(product_name, unit, price)",
    )
    .order("updated_at", { ascending: false });

  const enriched: EnrichedCatalog[] = (catalogs ?? []).map((c: any) => {
    const rawItems: CatalogItemLite[] = Array.isArray(c.items)
      ? c.items.map((it: any) => ({
          product_name: String(it.product_name ?? ""),
          unit: String(it.unit ?? ""),
          price: Number(it.price ?? 0),
        }))
      : [];

    return {
      id: c.id,
      restaurant_id: c.restaurant_id,
      supplier_name: c.supplier_name,
      delivery_days: c.delivery_days,
      min_order_amount:
        c.min_order_amount !== null ? Number(c.min_order_amount) : null,
      notes: c.notes,
      created_at: c.created_at,
      updated_at: c.updated_at,
      aggregates: computeAggregates(rawItems),
    };
  });

  return <CatalogsClient initialCatalogs={enriched} />;
}
