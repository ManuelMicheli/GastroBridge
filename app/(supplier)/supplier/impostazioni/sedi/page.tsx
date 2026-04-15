import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { WarehousesClient } from "./warehouses-client";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import type { Database } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

export const metadata: Metadata = { title: "Sedi / Magazzini" };

export default async function SupplierWarehousesPage() {
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
          Sedi / Magazzini
        </h1>
        <Card className="text-center py-16">
          <p className="text-sage">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select(
      "id, supplier_id, name, address, city, province, zip_code, latitude, longitude, is_primary, is_active, created_at",
    )
    .eq("supplier_id", supplier.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<WarehouseRow[]>();

  const supplierFilter = `supplier_id=eq.${supplier.id}`;

  return (
    <>
      <RealtimeRefresh
        subscriptions={[{ table: "warehouses", filter: supplierFilter }]}
      />
      <WarehousesClient
        supplierId={supplier.id}
        initialWarehouses={warehouses ?? []}
      />
    </>
  );
}
