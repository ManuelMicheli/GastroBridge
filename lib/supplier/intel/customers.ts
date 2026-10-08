/* eslint-disable @typescript-eslint/no-explicit-any */
// Customer intelligence loaders (server-only): cadence / at-risk clients,
// fall-off products, "similar clients also buy" suggestions, usual basket.
// Everything is computed from the supplier's real order history.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import {
  computeCadence,
  fallOffProducts,
  similarClientSuggestions,
  type ClientCadence,
  type ClientOrder,
  type ClientProductLine,
} from "./cadence";
import { getCreditSnapshots, type CreditSnapshot } from "./credit";

const DAY = 86_400_000;
const DEAD_STATES = new Set(["cancelled", "rejected"]);

export type SupplierSplitLite = {
  id: string;
  restaurantId: string;
  createdAt: string;
  subtotal: number;
  workflow: string;
};

/** Non-cancelled splits of the supplier created in the last `days` days. */
export async function loadSupplierSplitsSince(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  days: number,
): Promise<SupplierSplitLite[]> {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const out: SupplierSplitLite[] = [];
  const PAGE = 1000;
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = (await (supabase as any)
      .from("order_splits")
      .select("id, status, supplier_notes, subtotal, orders!inner(restaurant_id, created_at)")
      .eq("supplier_id", supplierId)
      .gte("orders.created_at", since)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)) as {
      data: Array<{
        id: string;
        status: string;
        supplier_notes: string | null;
        subtotal: number;
        orders: { restaurant_id: string; created_at: string } | null;
      }> | null;
      error: unknown;
    };
    if (error || !data) break;
    for (const r of data) {
      if (!r.orders) continue;
      const wf = getWorkflowState(r.status, r.supplier_notes);
      if (DEAD_STATES.has(wf)) continue;
      out.push({
        id: r.id,
        restaurantId: r.orders.restaurant_id,
        createdAt: r.orders.created_at,
        subtotal: Number(r.subtotal || 0),
        workflow: wf,
      });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

export type ClientRef = {
  relationshipId: string;
  restaurantId: string;
  name: string;
  city: string | null;
  phone: string | null;
  status: string;
};

export async function loadClientRefs(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  statuses: string[] = ["active", "paused"],
): Promise<ClientRef[]> {
  const { data } = (await (supabase as any)
    .from("restaurant_suppliers")
    .select("id, status, restaurant_id, restaurants:restaurant_id ( id, name, city, phone )")
    .eq("supplier_id", supplierId)
    .in("status", statuses)) as {
    data: Array<{
      id: string;
      status: string;
      restaurant_id: string;
      restaurants: { id: string; name: string; city: string | null; phone: string | null } | null;
    }> | null;
  };
  return (data ?? []).map((r) => ({
    relationshipId: r.id,
    restaurantId: r.restaurant_id,
    name: r.restaurants?.name ?? "Cliente",
    city: r.restaurants?.city ?? null,
    phone: r.restaurants?.phone ?? null,
    status: r.status,
  }));
}

export type CustomerInsightRow = ClientRef & ClientCadence & { credit: CreditSnapshot | null };

export async function getCustomerInsights(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
): Promise<{ rows: CustomerInsightRow[]; creditAvailable: boolean }> {
  const [clients, splits] = await Promise.all([
    loadClientRefs(supabase, supplierId),
    loadSupplierSplitsSince(supabase, supplierId, 180),
  ]);
  const ids = clients.map((c) => c.restaurantId);
  const orders: ClientOrder[] = splits.map((s) => ({
    restaurantId: s.restaurantId,
    createdAt: s.createdAt,
    subtotal: s.subtotal,
  }));
  const cadence = computeCadence(ids, orders);
  const credit = await getCreditSnapshots(supabase, supplierId, ids);

  const rows = clients.map((c) => ({
    ...c,
    ...cadence.get(c.restaurantId)!,
    credit: credit.snapshots.get(c.restaurantId) ?? null,
  }));
  rows.sort(
    (a, b) =>
      b.riskScore - a.riskScore ||
      b.revenueLast90 - a.revenueLast90 ||
      a.name.localeCompare(b.name),
  );
  return { rows, creditAvailable: credit.available };
}

/** Order lines (product level) for the given splits, rejected lines excluded. */
export async function loadProductLines(
  supabase: SupabaseClient<any, any, any>,
  splits: SupplierSplitLite[],
): Promise<ClientProductLine[]> {
  const bySplit = new Map(splits.map((s) => [s.id, s]));
  const ids = splits.map((s) => s.id);
  const out: ClientProductLine[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data } = (await (supabase as any)
      .from("order_split_items")
      .select("order_split_id, product_id, quantity_requested, quantity_accepted, status")
      .in("order_split_id", chunk)) as {
      data: Array<{
        order_split_id: string;
        product_id: string;
        quantity_requested: number;
        quantity_accepted: number | null;
        status: string;
      }> | null;
    };
    for (const l of data ?? []) {
      if (l.status === "rejected") continue;
      const s = bySplit.get(l.order_split_id);
      if (!s) continue;
      out.push({
        restaurantId: s.restaurantId,
        productId: l.product_id,
        orderedAt: s.createdAt,
        quantity: Number(l.quantity_accepted ?? l.quantity_requested),
      });
    }
  }
  return out;
}

export type ProductRef = {
  id: string;
  name: string;
  unit: string;
  price: number;
  isAvailable: boolean;
};

async function loadProducts(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  ids: string[],
): Promise<Map<string, ProductRef>> {
  const out = new Map<string, ProductRef>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = (await (supabase as any)
      .from("products")
      .select("id, name, unit, price, is_available")
      .eq("supplier_id", supplierId)
      .in("id", ids.slice(i, i + 200))) as {
      data: Array<{ id: string; name: string; unit: string; price: number; is_available: boolean }> | null;
    };
    for (const p of data ?? []) {
      out.set(p.id, { id: p.id, name: p.name, unit: p.unit, price: Number(p.price), isAvailable: p.is_available });
    }
  }
  return out;
}

export type UsualProduct = ProductRef & { orders: number; lastQuantity: number; lastOrderedAt: string };

export type ClientProductIntel = {
  cadence: ClientCadence | null;
  usual: UsualProduct[];
  fallOff: Array<ProductRef & { ordersInWindow: number; lastOrderedAt: string }>;
  suggestions: Array<ProductRef & { similarClients: number }>;
  similarClientsConsidered: number;
};

export async function getClientProductIntel(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  restaurantId: string,
): Promise<ClientProductIntel> {
  const splits = await loadSupplierSplitsSince(supabase, supplierId, 180);
  const lines = await loadProductLines(supabase, splits);
  const own = splits.filter((s) => s.restaurantId === restaurantId);
  const cadence =
    computeCadence(
      [restaurantId],
      own.map((s) => ({ restaurantId, createdAt: s.createdAt, subtotal: s.subtotal })),
    ).get(restaurantId) ?? null;

  const ownLines = lines.filter((l) => l.restaurantId === restaurantId);
  const usualMap = new Map<string, { orders: Set<string>; lastQuantity: number; last: string }>();
  const ninetyAgo = new Date(Date.now() - 90 * DAY).toISOString();
  for (const l of ownLines) {
    if (l.orderedAt < ninetyAgo) continue;
    const e = usualMap.get(l.productId) ?? { orders: new Set<string>(), lastQuantity: l.quantity, last: l.orderedAt };
    e.orders.add(l.orderedAt);
    if (l.orderedAt >= e.last) {
      e.last = l.orderedAt;
      e.lastQuantity = l.quantity;
    }
    usualMap.set(l.productId, e);
  }

  const fall = fallOffProducts(restaurantId, lines);
  const sugg = similarClientSuggestions(restaurantId, lines);
  const neighbourCount = new Set(
    lines.filter((l) => l.restaurantId !== restaurantId).map((l) => l.restaurantId),
  ).size;

  const productIds = [
    ...new Set([...usualMap.keys(), ...fall.map((f) => f.productId), ...sugg.map((s) => s.productId)]),
  ];
  const products = await loadProducts(supabase, supplierId, productIds);

  const usual: UsualProduct[] = [...usualMap.entries()]
    .map(([pid, e]) => {
      const p = products.get(pid);
      return p ? { ...p, orders: e.orders.size, lastQuantity: e.lastQuantity, lastOrderedAt: e.last } : null;
    })
    .filter((x): x is UsualProduct => x !== null)
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name));

  return {
    cadence,
    usual,
    fallOff: fall
      .map((f) => {
        const p = products.get(f.productId);
        return p ? { ...p, ordersInWindow: f.ordersInWindow, lastOrderedAt: f.lastOrderedAt } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 8),
    suggestions: sugg
      .map((s) => {
        const p = products.get(s.productId);
        return p && p.isAvailable ? { ...p, similarClients: s.similarClients } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    similarClientsConsidered: neighbourCount,
  };
}
