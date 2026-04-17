/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SuppliersClient } from "./suppliers-client";
import type { RelationshipRow } from "./_lib/types";

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

  const relationships: RelationshipRow[] = restaurant
    ? (
        ((await (supabase as any)
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
          .order("invited_at", { ascending: false })) as {
          data: RelationshipRow[] | null;
        }).data ?? []
      )
    : [];

  return (
    <SuppliersClient
      relationships={relationships}
      hasRestaurant={!!restaurant}
    />
  );
}
