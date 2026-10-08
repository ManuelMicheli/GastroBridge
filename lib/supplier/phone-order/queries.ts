/* eslint-disable @typescript-eslint/no-explicit-any */
// Phone / WhatsApp order entry — data for the form and server-side price
// resolution (server-only).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import { getCreditSnapshots, type CreditSnapshot } from "@/lib/supplier/intel/credit";
import { nextCutoffs } from "@/lib/supplier/intel/time";

export type PriceSource = "listino_cliente" | "listino_base" | "catalogo";

export type ClientPrice = {
  price: number;
  salesUnitId: string | null;
  salesUnitLabel: string | null;
  source: PriceSource;
};

/**
 * Price the client pays for each product: the price list assigned to the
 * client, else the supplier's default active list, else the catalog price.
 * Prices refer to the product's base sales unit (when sales units exist).
 */
export async function resolveClientPrices(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  restaurantId: string,
  products: Array<{ id: string; price: number }>,
): Promise<Map<string, ClientPrice>> {
  const out = new Map<string, ClientPrice>();
  if (products.length === 0) return out;
  const ids = products.map((p) => p.id);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: assignment }, { data: lists }] = await Promise.all([
    (supabase as any)
      .from("customer_price_assignments")
      .select("price_list_id")
      .eq("supplier_id", supplierId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    (supabase as any)
      .from("price_lists")
      .select("id, is_default, is_active, valid_from, valid_to")
      .eq("supplier_id", supplierId),
  ]);
  const validList = (l: { is_active: boolean; valid_from: string | null; valid_to: string | null }) =>
    l.is_active && (!l.valid_from || l.valid_from <= today) && (!l.valid_to || l.valid_to >= today);
  const allLists = (lists ?? []) as Array<{ id: string; is_default: boolean; is_active: boolean; valid_from: string | null; valid_to: string | null }>;
  const assignedId: string | null =
    assignment?.price_list_id && allLists.some((l) => l.id === assignment.price_list_id && validList(l))
      ? assignment.price_list_id
      : null;
  const defaultId = allLists.find((l) => l.is_default && validList(l))?.id ?? null;

  const units = new Map<string, { id: string; label: string }>();
  const listItems = new Map<string, { price: number; sales_unit_id: string }[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: su } = (await (supabase as any)
      .from("product_sales_units")
      .select("id, product_id, label, is_base, is_active, sort_order")
      .in("product_id", chunk)) as {
      data: Array<{ id: string; product_id: string; label: string; is_base: boolean; is_active: boolean; sort_order: number }> | null;
    };
    const sorted = (su ?? [])
      .filter((u) => u.is_active)
      .sort((a, b) => Number(b.is_base) - Number(a.is_base) || a.sort_order - b.sort_order);
    for (const u of sorted) if (!units.has(u.product_id)) units.set(u.product_id, { id: u.id, label: u.label });

    const listIds = [assignedId, defaultId].filter((x): x is string => !!x);
    if (listIds.length > 0) {
      const { data: items } = (await (supabase as any)
        .from("price_list_items")
        .select("price_list_id, product_id, sales_unit_id, price")
        .in("price_list_id", listIds)
        .in("product_id", chunk)) as {
        data: Array<{ price_list_id: string; product_id: string; sales_unit_id: string; price: number }> | null;
      };
      for (const it of items ?? []) {
        const key = `${it.price_list_id}|${it.product_id}`;
        const arr = listItems.get(key) ?? [];
        arr.push({ price: Number(it.price), sales_unit_id: it.sales_unit_id });
        listItems.set(key, arr);
      }
    }
  }

  const pick = (listId: string | null, productId: string, unitId: string | null) => {
    if (!listId) return null;
    const arr = listItems.get(`${listId}|${productId}`) ?? [];
    return arr.find((x) => x.sales_unit_id === unitId) ?? (unitId ? null : arr[0] ?? null);
  };

  for (const p of products) {
    const unit = units.get(p.id) ?? null;
    const assigned = pick(assignedId, p.id, unit?.id ?? null);
    const base = assigned ? null : pick(defaultId, p.id, unit?.id ?? null);
    out.set(p.id, {
      price: assigned?.price ?? base?.price ?? Number(p.price),
      salesUnitId: unit?.id ?? null,
      salesUnitLabel: unit?.label ?? null,
      source: assigned ? "listino_cliente" : base ? "listino_base" : "catalogo",
    });
  }
  return out;
}

export type PhoneOrderProduct = {
  id: string;
  name: string;
  unit: string;
  brand: string | null;
  price: number;
  priceSource: PriceSource;
  salesUnitLabel: string | null;
};

export type PhoneOrderContext = {
  client: {
    relationshipId: string;
    restaurantId: string;
    name: string;
    city: string | null;
    phone: string | null;
  };
  products: PhoneOrderProduct[];
  usual: Array<{ productId: string; orders: number; lastQuantity: number }>;
  lastOrder: { date: string; lines: Array<{ productId: string; quantity: number }> } | null;
  credit: CreditSnapshot | null;
  suggestedDelivery: { date: string; zoneId: string; zoneName: string; cutoffTime: string } | null;
  minOrderAmount: number | null;
};

export async function getPhoneOrderContext(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  relationshipId: string,
): Promise<PhoneOrderContext | null> {
  const { data: rel } = (await (supabase as any)
    .from("restaurant_suppliers")
    .select("id, status, restaurant_id, restaurants:restaurant_id ( id, name, city, phone, province, zip_code )")
    .eq("id", relationshipId)
    .eq("supplier_id", supplierId)
    .maybeSingle()) as {
    data: {
      id: string;
      status: string;
      restaurant_id: string;
      restaurants: { id: string; name: string; city: string | null; phone: string | null; province: string | null; zip_code: string | null } | null;
    } | null;
  };
  if (!rel || rel.status !== "active") return null;
  const restaurantId = rel.restaurant_id;

  const [{ data: prodRows }, { data: supplier }, { data: zones }] = await Promise.all([
    (supabase as any)
      .from("products")
      .select("id, name, unit, brand, price")
      .eq("supplier_id", supplierId)
      .eq("is_available", true)
      .order("name", { ascending: true })
      .limit(3000),
    (supabase as any).from("suppliers").select("min_order_amount").eq("id", supplierId).maybeSingle(),
    (supabase as any)
      .from("delivery_zones")
      .select("id, zone_name, provinces, zip_codes, cutoff_time, delivery_days")
      .eq("supplier_id", supplierId),
  ]);
  const productsRaw = (prodRows ?? []) as Array<{ id: string; name: string; unit: string; brand: string | null; price: number }>;
  const prices = await resolveClientPrices(supabase, supplierId, restaurantId, productsRaw);

  // History of this client (last 90 days) for "usual products" + "repeat last order".
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: splitRows } = (await (supabase as any)
    .from("order_splits")
    .select("id, status, supplier_notes, orders!inner(created_at, restaurant_id)")
    .eq("supplier_id", supplierId)
    .eq("orders.restaurant_id", restaurantId)
    .gte("orders.created_at", since)) as {
    data: Array<{ id: string; status: string; supplier_notes: string | null; orders: { created_at: string } | null }> | null;
  };
  const splits = (splitRows ?? []).filter(
    (s) => s.orders && !["cancelled", "rejected"].includes(getWorkflowState(s.status, s.supplier_notes)),
  );
  const splitDate = new Map(splits.map((s) => [s.id, s.orders!.created_at]));
  const usualMap = new Map<string, { orders: Set<string>; lastQuantity: number; last: string }>();
  let lastOrder: PhoneOrderContext["lastOrder"] = null;
  if (splits.length > 0) {
    const { data: items } = (await (supabase as any)
      .from("order_split_items")
      .select("order_split_id, product_id, quantity_requested, quantity_accepted, status")
      .in("order_split_id", splits.map((s) => s.id).slice(0, 300))) as {
      data: Array<{ order_split_id: string; product_id: string; quantity_requested: number; quantity_accepted: number | null; status: string }> | null;
    };
    const latestSplit = [...splits].sort((a, b) => b.orders!.created_at.localeCompare(a.orders!.created_at))[0]!;
    const lastLines: Array<{ productId: string; quantity: number }> = [];
    for (const it of items ?? []) {
      const at = splitDate.get(it.order_split_id);
      if (!at) continue;
      // What the client asked for (the request) is the best "usual quantity".
      const qty = Number(it.quantity_requested);
      const e = usualMap.get(it.product_id) ?? { orders: new Set<string>(), lastQuantity: qty, last: at };
      e.orders.add(it.order_split_id);
      if (at >= e.last) {
        e.last = at;
        e.lastQuantity = qty;
      }
      usualMap.set(it.product_id, e);
      if (it.order_split_id === latestSplit.id) lastLines.push({ productId: it.product_id, quantity: qty });
    }
    lastOrder = { date: latestSplit.orders!.created_at, lines: lastLines };
  }

  const credit = await getCreditSnapshots(supabase, supplierId, [restaurantId]);

  // Delivery zone of the client (CAP first, then province) → next delivery
  // date whose cut-off is still open.
  const r = rel.restaurants;
  const zoneRows = (zones ?? []) as Array<{
    id: string;
    zone_name: string | null;
    provinces: string[] | null;
    zip_codes: string[] | null;
    cutoff_time: string | null;
    delivery_days: number[] | null;
  }>;
  const zone =
    zoneRows.find((z) => r?.zip_code && (z.zip_codes ?? []).includes(r.zip_code)) ??
    zoneRows.find((z) => r?.province && (z.provinces ?? []).map((p) => p.toUpperCase()).includes(r.province.toUpperCase())) ??
    null;
  const next = zone ? nextCutoffs([zone])[0] ?? null : null;

  return {
    client: {
      relationshipId: rel.id,
      restaurantId,
      name: r?.name ?? "Cliente",
      city: r?.city ?? null,
      phone: r?.phone ?? null,
    },
    products: productsRaw.map((p) => {
      const pr = prices.get(p.id)!;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        brand: p.brand,
        price: pr.price,
        priceSource: pr.source,
        salesUnitLabel: pr.salesUnitLabel,
      };
    }),
    usual: [...usualMap.entries()]
      .map(([productId, e]) => ({ productId, orders: e.orders.size, lastQuantity: e.lastQuantity }))
      .sort((a, b) => b.orders - a.orders),
    lastOrder,
    credit: credit.snapshots.get(restaurantId) ?? null,
    suggestedDelivery:
      next && zone ? { date: next.deliveryDate, zoneId: zone.id, zoneName: next.zoneName, cutoffTime: next.cutoffTime } : null,
    minOrderAmount: supplier?.min_order_amount ? Number(supplier.min_order_amount) : null,
  };
}
