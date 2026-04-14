/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { CatalogsClient } from "./catalogs-client";
import type { CatalogRow } from "@/lib/catalogs/types";

type CatalogWithCount = CatalogRow & { item_count: number };

export default async function CatalogsPage() {
  const supabase = await createClient();

  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("*, items:restaurant_catalog_items(count)")
    .order("updated_at", { ascending: false });

  const flattened: CatalogWithCount[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    restaurant_id:    c.restaurant_id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days,
    min_order_amount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
    notes:            c.notes,
    created_at:       c.created_at,
    updated_at:       c.updated_at,
    item_count:       Array.isArray(c.items) ? (c.items[0]?.count ?? 0) : 0,
  }));

  return <CatalogsClient initialCatalogs={flattened} />;
}
