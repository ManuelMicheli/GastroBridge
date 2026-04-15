import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { ZonesClient } from "./zones-client";
import type { Database } from "@/types/database";

type ZoneRow = Database["public"]["Tables"]["delivery_zones"]["Row"];
type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

export const metadata: Metadata = { title: "Zone di Consegna" };

export default async function DeliveryZonesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .maybeSingle<{ id: string }>();

  if (!supplier?.id) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-charcoal mb-6">
          Zone di Consegna
        </h1>
        <Card className="text-center py-16">
          <p className="text-sage">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  const [{ data: zones }, { data: warehouses }] = await Promise.all([
    supabase
      .from("delivery_zones")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: true })
      .returns<ZoneRow[]>(),
    supabase
      .from("warehouses")
      .select(
        "id, supplier_id, name, address, city, province, zip_code, latitude, longitude, is_primary, is_active, created_at",
      )
      .eq("supplier_id", supplier.id)
      .eq("is_active", true)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .returns<WarehouseRow[]>(),
  ]);

  const supplierFilter = `supplier_id=eq.${supplier.id}`;

  return (
    <>
      <RealtimeRefresh
        subscriptions={[
          { table: "delivery_zones", filter: supplierFilter },
        ]}
      />
      <ZonesClient
        supplierId={supplier.id}
        initialZones={zones ?? []}
        warehouses={warehouses ?? []}
      />
    </>
  );
}
