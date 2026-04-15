import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { getLots } from "@/lib/supplier/stock/queries";
import { LotsClient } from "./lots-client";

export const metadata: Metadata = { title: "Lotti — Magazzino" };

type SearchParams = {
  warehouse?: string;
  product?: string;
  q?: string;
  expiring?: string;
};

export default async function SupplierLotsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-charcoal">Lotti</h1>
        <Card className="text-center py-16">
          <p className="text-sage">
            Nessun profilo fornitore associato a questo utente.
          </p>
        </Card>
      </div>
    );
  }

  const lots = await getLots(supplier.id, {
    warehouseId: params.warehouse,
    productId: params.product,
  });

  // Elenco prodotti distinti per il filtro "per prodotto".
  const productsById = new Map<string, string>();
  for (const l of lots) productsById.set(l.product_id, l.product_name);
  const products = Array.from(productsById.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-charcoal">Lotti</h1>
        <p className="text-sm text-sage">
          Ordinati per scadenza (FEFO). I semafori indicano lo stato: rosso =
          scaduto, ambra ≤ 7 giorni, giallo ≤ 30 giorni.
        </p>
      </div>
      <LotsClient
        lots={lots}
        products={products}
        initialQ={params.q ?? ""}
        initialExpiring={(params.expiring as "all" | "expired" | "7" | "30") ?? "all"}
        initialProductId={params.product ?? ""}
      />
    </div>
  );
}
