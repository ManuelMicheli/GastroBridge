/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CatalogDetailClient } from "./catalog-detail-client";
import type { CatalogRow, CatalogItemRow } from "@/lib/catalogs/types";

export default async function CatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: catalog } = await supabase
    .from("restaurant_catalogs")
    .select("*")
    .eq("id", id)
    .single<CatalogRow>();

  if (!catalog) notFound();

  const { data: items } = await supabase
    .from("restaurant_catalog_items")
    .select("*")
    .eq("catalog_id", id)
    .order("product_name", { ascending: true });

  const rows: CatalogItemRow[] = (items ?? []).map((r: any) => ({
    ...r,
    price: Number(r.price),
  }));

  return (
    <CatalogDetailClient
      catalog={{ ...catalog, min_order_amount: catalog.min_order_amount !== null ? Number(catalog.min_order_amount) : null }}
      initialItems={rows}
    />
  );
}
