import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/restaurants/context";
import { RESTAURANT_ROLE_LABELS } from "@/lib/restaurants/permissions";
import { RestrictedSettings } from "../_components/restricted-settings";
import { SediClient } from "./sedi-client";
import type { RestaurantRow } from "@/lib/restaurants/types";

export const metadata: Metadata = { title: "Sedi" };

export default async function LocationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Locations belong to the account owner; team members work on one of them.
  const ctx = await getRestaurantContext();
  if (ctx && !ctx.isOwner) {
    return (
      <RestrictedSettings
        title="Sedi"
        body={`Fai parte del team di ${ctx.restaurantName} come ${RESTAURANT_ROLE_LABELS[ctx.role]}: le sedi sono gestite dal titolare.`}
      />
    );
  }

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
