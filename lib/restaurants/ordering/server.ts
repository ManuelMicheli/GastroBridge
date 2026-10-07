/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-side loaders for the restaurant ordering superpowers: orderable
// offers, purchase history and delivery schedules. Every query runs with the
// user's Supabase client, so RLS (owner + team members) applies.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { parseLineItems } from "@/lib/analytics/notes-parser";
import type { RestaurantContext } from "@/lib/restaurants/context";
import { catalogItemKey, normalizeName, productItemKey, stripUnitSuffix } from "./text.ts";
import type { PurchaseEvent } from "./predict.ts";
import type { Offer, ScheduleInfo, SupplierRef } from "./types";

const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

export type OfferCatalog = {
  offers: Offer[];
  suppliers: SupplierRef[];
};

/** Everything the restaurant can order now: connected suppliers + private catalogs. */
export const loadOrderableOffers = cache(async (scopeIds: string[]): Promise<OfferCatalog> => {
  if (scopeIds.length === 0) return { offers: [], suppliers: [] };
  const supabase = (await createClient()) as any;

  const [relsRes, catalogsRes] = await Promise.all([
    supabase
      .from("restaurant_suppliers")
      .select("supplier_id, supplier:suppliers!supplier_id (id, company_name, min_order_amount)")
      .in("restaurant_id", scopeIds)
      .eq("status", "active"),
    supabase
      .from("restaurant_catalogs")
      .select("id, restaurant_id, supplier_name, delivery_days, min_order_amount")
      .in("restaurant_id", scopeIds)
      .order("supplier_name", { ascending: true }),
  ]);

  const suppliers: SupplierRef[] = [];
  const seen = new Set<string>();
  for (const r of (relsRes.data ?? []) as {
    supplier: { id: string; company_name: string | null; min_order_amount: number | string | null } | null;
  }[]) {
    const s = r.supplier;
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    suppliers.push({
      key: s.id,
      kind: "product",
      name: s.company_name?.trim() || "Fornitore",
      minOrderAmount: s.min_order_amount !== null ? Number(s.min_order_amount) : null,
      catalogLeadDays: null,
      restaurantId: null,
    });
  }
  const catalogs = (catalogsRes.data ?? []) as {
    id: string;
    restaurant_id: string;
    supplier_name: string;
    delivery_days: number | null;
    min_order_amount: number | string | null;
  }[];
  for (const c of catalogs) {
    suppliers.push({
      key: c.id,
      kind: "catalog",
      name: c.supplier_name,
      minOrderAmount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
      catalogLeadDays: c.delivery_days,
      restaurantId: c.restaurant_id,
    });
  }

  const supplierName = new Map(suppliers.map((s) => [s.key, s.name]));
  const productSupplierIds = suppliers.filter((s) => s.kind === "product").map((s) => s.key);
  const catalogIds = catalogs.map((c) => c.id);

  const [productsRes, itemsRes] = await Promise.all([
    productSupplierIds.length > 0
      ? supabase
          .from("products")
          .select("id, supplier_id, name, unit, price, brand, image_url, min_quantity, packaging_size, packaging_unit")
          .in("supplier_id", productSupplierIds)
          .eq("is_available", true)
          .limit(5000)
      : Promise.resolve({ data: [] }),
    catalogIds.length > 0
      ? supabase
          .from("restaurant_catalog_items")
          .select("id, catalog_id, product_name, product_name_normalized, unit, price")
          .in("catalog_id", catalogIds)
          .limit(10000)
      : Promise.resolve({ data: [] }),
  ]);

  const offers: Offer[] = [];
  for (const p of (productsRes.data ?? []) as {
    id: string;
    supplier_id: string;
    name: string;
    unit: string;
    price: number | string;
    brand: string | null;
    image_url: string | null;
    min_quantity: number | null;
    packaging_size: number | null;
    packaging_unit: string | null;
  }[]) {
    const pack = p.packaging_size && p.packaging_unit ? ` ${p.packaging_size} ${p.packaging_unit}` : "";
    offers.push({
      key: productItemKey(p.id),
      kind: "product",
      offerId: p.id,
      cartProductId: p.id,
      supplierKey: p.supplier_id,
      supplierName: supplierName.get(p.supplier_id) ?? "Fornitore",
      name: p.name,
      packName: `${p.name}${pack}`,
      unit: p.unit,
      price: Number(p.price),
      brand: p.brand,
      imageUrl: p.image_url,
      minQuantity: Number(p.min_quantity ?? 1) || 1,
    });
  }
  for (const it of (itemsRes.data ?? []) as {
    id: string;
    catalog_id: string;
    product_name: string;
    product_name_normalized: string;
    unit: string;
    price: number | string;
  }[]) {
    offers.push({
      key: catalogItemKey(it.catalog_id, it.product_name_normalized, it.unit),
      kind: "catalog",
      offerId: it.id,
      cartProductId: `catalog_${it.id}`,
      supplierKey: it.catalog_id,
      supplierName: supplierName.get(it.catalog_id) ?? "Fornitore",
      name: it.product_name,
      packName: it.product_name,
      unit: it.unit,
      price: Number(it.price),
      brand: null,
      imageUrl: null,
      minQuantity: 1,
    });
  }

  return { offers, suppliers };
});

/* ------------------------------------------------------------------ */
/* Purchase history                                                    */
/* ------------------------------------------------------------------ */

export type HistoryItem = {
  key: string;
  supplierKey: string;
  supplierName: string;
  name: string;
  unit: string;
  events: PurchaseEvent[];
};

export type PurchaseHistory = {
  items: Map<string, HistoryItem>;
  /** Last order time per supplier key (any order, incl. cancelled excluded). */
  lastOrderAtBySupplier: Map<string, string>;
};

/**
 * Purchases of the last `days` days per item key. Marketplace orders come from
 * order_items; private-catalog orders are parsed from the order notes and
 * matched to today's catalog lines (same catalog, same normalized name).
 */
export const loadPurchaseHistory = cache(
  async (scopeIds: string[], days: number, catalog: OfferCatalog): Promise<PurchaseHistory> => {
    const items = new Map<string, HistoryItem>();
    const lastOrderAtBySupplier = new Map<string, string>();
    if (scopeIds.length === 0) return { items, lastOrderAtBySupplier };
    const supabase = (await createClient()) as any;

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: orders } = (await supabase
      .from("orders")
      .select("id, created_at, status, notes")
      .in("restaurant_id", scopeIds)
      .gte("created_at", since)
      .not("status", "in", "(cancelled,draft)")
      .order("created_at", { ascending: true })
      .limit(2000)) as {
      data: { id: string; created_at: string; status: string; notes: string | null }[] | null;
    };
    const orderRows = orders ?? [];
    if (orderRows.length === 0) return { items, lastOrderAtBySupplier };
    const orderAt = new Map(orderRows.map((o) => [o.id, o.created_at]));

    const bump = (supplierKey: string, at: string) => {
      const cur = lastOrderAtBySupplier.get(supplierKey);
      if (!cur || at > cur) lastOrderAtBySupplier.set(supplierKey, at);
    };
    const push = (h: Omit<HistoryItem, "events">, e: PurchaseEvent) => {
      const cur = items.get(h.key);
      if (cur) cur.events.push(e);
      else items.set(h.key, { ...h, events: [e] });
    };

    // 1. Marketplace lines.
    const withItems = new Set<string>();
    for (const ids of chunk(orderRows.map((o) => o.id), 150)) {
      const { data: lines } = (await supabase
        .from("order_items")
        .select("order_id, product_id, supplier_id, quantity, unit_price, products(name, unit), suppliers(company_name)")
        .in("order_id", ids)) as {
        data:
          | {
              order_id: string;
              product_id: string;
              supplier_id: string;
              quantity: number | string;
              unit_price: number | string;
              products: { name: string; unit: string } | null;
              suppliers: { company_name: string } | null;
            }[]
          | null;
      };
      for (const l of lines ?? []) {
        const at = orderAt.get(l.order_id);
        if (!at) continue;
        withItems.add(l.order_id);
        bump(l.supplier_id, at);
        push(
          {
            key: productItemKey(l.product_id),
            supplierKey: l.supplier_id,
            supplierName: l.suppliers?.company_name ?? "Fornitore",
            name: l.products?.name ?? "Prodotto",
            unit: l.products?.unit ?? "pz",
          },
          { at, qty: Number(l.quantity), unitPrice: Number(l.unit_price) },
        );
      }
    }

    // 2. Private-catalog orders (header-only, lines in the notes).
    const catalogByName = new Map<string, SupplierRef>();
    for (const s of catalog.suppliers) {
      if (s.kind === "catalog") catalogByName.set(s.name.trim().toLowerCase(), s);
    }
    const catalogOffers = new Map<string, Offer[]>(); // "<catalogId>|<normalized name>" → offers
    for (const o of catalog.offers) {
      if (o.kind !== "catalog") continue;
      const k = `${o.supplierKey}|${normalizeName(o.name)}`;
      const arr = catalogOffers.get(k);
      if (arr) arr.push(o);
      else catalogOffers.set(k, [o]);
    }
    for (const o of orderRows) {
      if (withItems.has(o.id) || !o.notes || !o.notes.includes("---")) continue;
      for (const li of parseLineItems(o.notes)) {
        const sup = catalogByName.get(li.supplier.trim().toLowerCase());
        if (!sup) continue;
        bump(sup.key, o.created_at);
        const unitMatch = li.productName.match(/\(([^()]{1,24})\)\s*$/);
        const writtenUnit = unitMatch?.[1]?.trim().toLowerCase() ?? null;
        const base = normalizeName(stripUnitSuffix(li.productName));
        const candidates = catalogOffers.get(`${sup.key}|${base}`) ?? [];
        const offer =
          candidates.find((c) => writtenUnit && c.unit.trim().toLowerCase() === writtenUnit) ?? candidates[0];
        const key = offer ? offer.key : catalogItemKey(sup.key, base, writtenUnit ?? "pz");
        push(
          {
            key,
            supplierKey: sup.key,
            supplierName: sup.name,
            name: offer?.name ?? stripUnitSuffix(li.productName),
            unit: offer?.unit ?? writtenUnit ?? "pz",
          },
          { at: o.created_at, qty: li.quantity, unitPrice: li.unitPrice },
        );
      }
    }

    return { items, lastOrderAtBySupplier };
  },
);

/* ------------------------------------------------------------------ */
/* Delivery schedules                                                  */
/* ------------------------------------------------------------------ */

type ScheduleRow = {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  catalog_id: string | null;
  delivery_weekdays: number[] | null;
  cutoff_time: string | null;
  lead_days: number | null;
  reminder_enabled: boolean | null;
  notes: string | null;
};

type ZoneRow = {
  supplier_id: string;
  provinces: string[] | null;
  zip_codes: string[] | null;
  delivery_days: number[] | null;
  cutoff_time: string | null;
};

/**
 * Delivery days + cut-off per supplier key. Restaurant-defined schedules
 * (/consegne) win; platform suppliers otherwise use the delivery zone that
 * covers the restaurant's CAP / province. Tolerates the migration not being
 * applied yet (returns what it can).
 */
export const loadSchedules = cache(
  async (ctx: Pick<RestaurantContext, "restaurantId" | "scopeIds">, suppliers: SupplierRef[]): Promise<Map<string, ScheduleInfo>> => {
    const out = new Map<string, ScheduleInfo>();
    if (suppliers.length === 0) return out;
    const supabase = (await createClient()) as any;
    const productIds = suppliers.filter((s) => s.kind === "product").map((s) => s.key);

    const [schedRes, restRes, zonesRes] = await Promise.all([
      supabase
        .from("restaurant_supplier_schedules")
        .select("id, restaurant_id, supplier_id, catalog_id, delivery_weekdays, cutoff_time, lead_days, reminder_enabled, notes")
        .in("restaurant_id", ctx.scopeIds.length > 0 ? ctx.scopeIds : [PLACEHOLDER_ID]),
      supabase.from("restaurants").select("id, province, zip_code").eq("id", ctx.restaurantId).maybeSingle(),
      productIds.length > 0
        ? supabase
            .from("delivery_zones")
            .select("supplier_id, provinces, zip_codes, delivery_days, cutoff_time")
            .in("supplier_id", productIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Supplier zones first, then restaurant overrides on top.
    const rest = restRes.data as { province: string | null; zip_code: string | null } | null;
    const province = rest?.province?.trim().toLowerCase() ?? null;
    const zip = rest?.zip_code?.trim() ?? null;
    for (const z of (zonesRes.data ?? []) as ZoneRow[]) {
      if (out.has(z.supplier_id)) continue;
      const days = (z.delivery_days ?? []).filter((d) => d >= 0 && d <= 6);
      if (days.length === 0) continue;
      const zipHit = !!zip && (z.zip_codes ?? []).some((c) => c.trim() === zip);
      const provHit = !!province && (z.provinces ?? []).some((p) => p.trim().toLowerCase() === province);
      if (!zipHit && !provHit) continue;
      out.set(z.supplier_id, {
        weekdays: days,
        cutoffTime: z.cutoff_time,
        leadDays: 1,
        reminderEnabled: true,
        source: "supplier",
        scheduleId: null,
        notes: null,
      });
    }

    const rows = (schedRes.error ? [] : (schedRes.data ?? [])) as ScheduleRow[];
    // Active restaurant's row wins over other sedi for the same supplier.
    rows.sort((a, b) => (a.restaurant_id === ctx.restaurantId ? 1 : 0) - (b.restaurant_id === ctx.restaurantId ? 1 : 0));
    for (const r of rows) {
      const key = r.supplier_id ?? r.catalog_id;
      if (!key) continue;
      out.set(key, {
        weekdays: (r.delivery_weekdays ?? []).map(Number),
        cutoffTime: r.cutoff_time,
        leadDays: Number(r.lead_days ?? 1),
        reminderEnabled: r.reminder_enabled !== false,
        source: "restaurant",
        scheduleId: r.id,
        notes: r.notes,
      });
    }
    return out;
  },
);

/** Par levels of the active scope keyed by item key (empty when the table is missing). */
export const loadParLevels = cache(async (restaurantId: string): Promise<Map<string, number>> => {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from("restaurant_par_levels")
    .select("item_key, par_qty")
    .eq("restaurant_id", restaurantId);
  const out = new Map<string, number>();
  if (error) return out;
  for (const r of (data ?? []) as { item_key: string; par_qty: number | string }[]) {
    out.set(r.item_key, Number(r.par_qty));
  }
  return out;
});
