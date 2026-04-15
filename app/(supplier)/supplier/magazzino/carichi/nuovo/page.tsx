import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { ReceiveFormClient } from "./receive-form-client";
import type { Database } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export const metadata: Metadata = { title: "Nuovo carico" };

export default async function NuovoCaricoPage() {
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
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          Nuovo carico
        </h1>
        <Card className="text-center py-16">
          <p className="text-text-secondary">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  const { data: warehouses } = await supabase
    .from("warehouses")
    .select("id, name, is_primary")
    .eq("supplier_id", supplier.id)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<Pick<WarehouseRow, "id" | "name" | "is_primary">[]>();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("supplier_id", supplier.id)
    .eq("is_available", true)
    .order("name", { ascending: true })
    .returns<Pick<ProductRow, "id" | "name" | "sku">[]>();

  const warehouseList = (warehouses ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    isPrimary: w.is_primary,
  }));

  if (warehouseList.length === 0) {
    return (
      <div>
        <div className="mb-4 text-sm text-text-secondary">
          <Link
            href="/supplier/magazzino/carichi"
            className="hover:text-accent-green"
          >
            ← Carichi
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          Nuovo carico
        </h1>
        <Card className="text-center py-16">
          <p className="text-text-secondary mb-3">
            Nessun magazzino attivo. Crea una sede per iniziare a registrare carichi.
          </p>
          <Link
            href="/supplier/impostazioni/sedi"
            className="text-accent-green hover:underline"
          >
            Vai a Sedi
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 text-sm text-text-secondary">
        <Link
          href="/supplier/magazzino/carichi"
          className="hover:text-accent-green"
        >
          ← Carichi
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-text-primary mb-1">
        Nuovo carico
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Registra un nuovo lotto in ingresso. Le quantità sono espresse nell&apos;unità
        di vendita selezionata e vengono convertite in unità base automaticamente.
      </p>
      <ReceiveFormClient
        supplierId={supplier.id}
        warehouses={warehouseList}
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
        }))}
      />
    </div>
  );
}
