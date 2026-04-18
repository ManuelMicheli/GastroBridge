/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";
import { loadConnectedSupplierCatalogs } from "@/lib/catalogs/connected-suppliers";
import { CatalogsClient, type EnrichedCatalog } from "./catalogs-client";
import { computeAggregates, type CatalogItemLite } from "./_lib/aggregates";

export default async function CatalogsPage() {
  const supabase = await createClient();

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  // Fetch manual catalogs + items in a single join. Volume is low (<50 catalogs,
  // a few thousand items max), so server-side in-memory aggregation is fine.
  const [{ data: catalogs }, connected] = await Promise.all([
    supabase
      .from("restaurant_catalogs")
      .select(
        "id, restaurant_id, supplier_name, delivery_days, min_order_amount, notes, created_at, updated_at, items:restaurant_catalog_items(product_name, unit, price)",
      )
      .order("updated_at", { ascending: false }),
    loadConnectedSupplierCatalogs(userId),
  ]);

  const manual: EnrichedCatalog[] = (catalogs ?? []).map((c: any) => {
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

  // Shape connected suppliers into EnrichedCatalog rows: one per supplier.
  const nowIso = new Date().toISOString();
  const itemsBySupplier = new Map<string, CatalogItemLite[]>();
  const timestampsBySupplier = new Map<
    string,
    { first: string; last: string }
  >();

  for (const it of connected.items) {
    // `catalog_id` on ConnectedCatalogItem is actually the supplier id
    // (see loadConnectedSupplierCatalogs: catalog_id = p.supplier_id).
    const sid = it.catalog_id;

    const bucket = itemsBySupplier.get(sid) ?? [];
    bucket.push({
      product_name: it.product_name,
      unit: it.unit,
      price: Number(it.price),
    });
    itemsBySupplier.set(sid, bucket);

    const ts = timestampsBySupplier.get(sid);
    if (!ts) {
      timestampsBySupplier.set(sid, { first: it.created_at, last: it.created_at });
    } else {
      if (it.created_at < ts.first) ts.first = it.created_at;
      if (it.created_at > ts.last) ts.last = it.created_at;
    }
  }

  const connectedRows: EnrichedCatalog[] = connected.suppliers.map((s) => {
    const rawItems = itemsBySupplier.get(s.id) ?? [];
    const ts = timestampsBySupplier.get(s.id);
    return {
      id: s.id,
      restaurant_id: "",
      supplier_name: s.supplier_name,
      delivery_days: s.delivery_days,
      min_order_amount: s.min_order_amount,
      notes: null,
      created_at: ts?.first ?? nowIso,
      updated_at: ts?.last ?? nowIso,
      source: "connected",
      aggregates: computeAggregates(rawItems),
    };
  });

  const combined = [...manual, ...connectedRows].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return <CatalogsClient initialCatalogs={combined} />;
}
