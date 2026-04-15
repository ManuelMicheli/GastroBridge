/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SearchPageClient, type SupplierLite, type CatalogItemLite } from "./search-client";

export const metadata: Metadata = { title: "Cerca Prodotti" };

export default async function SearchPage() {
  const supabase = await createClient();

  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("id, supplier_name")
    .order("supplier_name", { ascending: true });

  const suppliers: SupplierLite[] = (catalogs ?? []).map((c: any) => ({
    id:            c.id,
    supplier_name: c.supplier_name,
  }));

  let items: CatalogItemLite[] = [];
  if (suppliers.length > 0) {
    const ids = suppliers.map((s) => s.id);
    const { data } = await supabase
      .from("restaurant_catalog_items")
      .select("id, catalog_id, product_name, product_name_normalized, unit, price, notes")
      .in("catalog_id", ids as any);
    items = (data ?? []).map((r: any) => ({
      id:                       r.id,
      catalog_id:               r.catalog_id,
      product_name:             r.product_name,
      product_name_normalized:  r.product_name_normalized,
      unit:                     r.unit,
      price:                    Number(r.price),
      notes:                    r.notes,
    }));
  }

  return <SearchPageClient suppliers={suppliers} items={items} />;
}
