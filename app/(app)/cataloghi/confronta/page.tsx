/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompareClient } from "./compare-client";
import type { SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";

export default async function CatalogComparePage() {
  const supabase = await createClient();

  const { data: catalogs } = await supabase
    .from("restaurant_catalogs")
    .select("id, supplier_name, delivery_days, min_order_amount")
    .order("supplier_name", { ascending: true });

  const suppliers: SupplierCol[] = (catalogs ?? []).map((c: any) => ({
    id:               c.id,
    supplier_name:    c.supplier_name,
    delivery_days:    c.delivery_days,
    min_order_amount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
  }));

  if (suppliers.length < 2) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold text-text-primary">Confronto prezzi</h1>
        <p className="text-text-secondary">Servono almeno 2 cataloghi per confrontare.</p>
        <Link href="/cataloghi" className="text-accent-green hover:underline">← Torna ai cataloghi</Link>
      </div>
    );
  }

  const ids = suppliers.map((s) => s.id);
  const { data: items } = await supabase
    .from("restaurant_catalog_items")
    .select("*")
    .in("catalog_id", ids as any);

  const rows: (CatalogItemRow & { catalog_id: string })[] = (items ?? []).map((r: any) => ({
    ...r,
    price: Number(r.price),
  }));

  return <CompareClient suppliers={suppliers} items={rows} />;
}
