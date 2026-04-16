import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SediClient } from "./sedi-client";
import type { RestaurantRow } from "@/lib/restaurants/types";

export const metadata: Metadata = { title: "Sedi" };

export default async function LocationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("restaurants")
    .select(
      "id, profile_id, name, cuisine, covers, address, city, province, zip_code, phone, email, is_primary, created_at, updated_at",
    )
    .eq("profile_id", user?.id ?? "")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<RestaurantRow[]>();

  return <SediClient initialLocations={data ?? []} />;
}
