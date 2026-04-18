/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SuppliersClient } from "./suppliers-client";
import type { RelationshipRow } from "./_lib/types";
import {
  computeAggregates,
  type CatalogItemLite,
} from "@/app/(app)/cataloghi/_lib/aggregates";
import type { EnrichedCatalog } from "@/app/(app)/cataloghi/catalogs-client";

export type ImportedCatalog = EnrichedCatalog;

export const metadata: Metadata = { title: "Fornitori" };

export default async function SuppliersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .limit(1)
    .maybeSingle<{ id: string }>();

  const [relationshipsRes, catalogsRes] = await Promise.all([
    restaurant
      ? (supabase as any)
          .from("restaurant_suppliers")
          .select(
            `id, status, invited_at,
             supplier:suppliers!supplier_id (
               id, company_name, description, city, province,
               rating_avg, rating_count, is_verified, certifications, logo_url
             )`,
          )
          .eq("restaurant_id", restaurant.id)
          .in("status", ["active", "pending", "paused"])
          .order("invited_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    restaurant
      ? supabase
          .from("restaurant_catalogs")
          .select(
            "id, restaurant_id, supplier_name, delivery_days, min_order_amount, notes, created_at, updated_at, items:restaurant_catalog_items(product_name, unit, price)",
          )
          .eq("restaurant_id", restaurant.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const relationships: RelationshipRow[] =
    (relationshipsRes as { data: RelationshipRow[] | null }).data ?? [];

  const importedCatalogs: ImportedCatalog[] = (
    (catalogsRes as { data: any[] | null }).data ?? []
  ).map((c: any) => {
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
      source: "manual",
      aggregates: computeAggregates(rawItems),
    };
  });

  return (
    <SuppliersClient
      relationships={relationships}
      hasRestaurant={!!restaurant}
      importedCatalogs={importedCatalogs}
    />
  );
}
