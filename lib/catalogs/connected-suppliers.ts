/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { normalizeName, normalizeUnit } from "./normalize";

export type ConnectedSupplierCol = {
  id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
};

export type ConnectedCatalogItem = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
  created_at: string;
};

type ConnectedRel = {
  supplier_id: string;
  status: string;
  supplier: {
    id: string;
    company_name: string;
    min_order_amount: number | string | null;
  } | null;
};

/**
 * Carica i fornitori realmente collegati al ristoratore (restaurant_suppliers
 * con status='active') e i loro prodotti disponibili, in un formato compatibile
 * con `SupplierCol` / `CatalogItemRow` della compare UI.
 *
 * Usato da `/cataloghi/confronta` e `/cerca`. Se il ristoratore non ha
 * ristoranti o non ha relazioni attive, ritorna liste vuote.
 */
export async function loadConnectedSupplierCatalogs(userId: string): Promise<{
  suppliers: ConnectedSupplierCol[];
  items: ConnectedCatalogItem[];
}> {
  if (!userId) return { suppliers: [], items: [] };

  const supabase = await createClient();

  const { data: restaurants } = (await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", userId)) as { data: { id: string }[] | null };
  const restaurantIds = (restaurants ?? []).map((r) => r.id);
  if (restaurantIds.length === 0) return { suppliers: [], items: [] };

  const { data: rels } = (await (supabase as any)
    .from("restaurant_suppliers")
    .select(
      `supplier_id, status,
       supplier:suppliers!supplier_id (id, company_name, min_order_amount)`,
    )
    .in("restaurant_id", restaurantIds)
    .eq("status", "active")) as { data: ConnectedRel[] | null };

  const validRels = (rels ?? []).filter(
    (r): r is ConnectedRel & { supplier: NonNullable<ConnectedRel["supplier"]> } =>
      r.supplier !== null,
  );

  const suppliers: ConnectedSupplierCol[] = validRels
    .map((r) => r.supplier)
    .filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx)
    .map((s) => ({
      id:               s.id,
      supplier_name:    s.company_name,
      delivery_days:    null,
      min_order_amount:
        s.min_order_amount !== null && s.min_order_amount !== undefined
          ? Number(s.min_order_amount)
          : null,
    }));

  if (suppliers.length === 0) return { suppliers: [], items: [] };

  const supplierIds = suppliers.map((s) => s.id);
  const { data: products } = (await supabase
    .from("products")
    .select("id, supplier_id, name, unit, price, created_at")
    .in("supplier_id", supplierIds)
    .eq("is_available", true)) as {
    data:
      | {
          id: string;
          supplier_id: string;
          name: string;
          unit: string;
          price: number | string;
          created_at: string;
        }[]
      | null;
  };

  const items: ConnectedCatalogItem[] = (products ?? []).map((p) => ({
    id:                      p.id,
    catalog_id:              p.supplier_id,
    product_name:            p.name,
    product_name_normalized: normalizeName(p.name),
    unit:                    normalizeUnit(p.unit),
    price:                   Number(p.price),
    notes:                   null,
    created_at:              p.created_at,
  }));

  return { suppliers, items };
}
