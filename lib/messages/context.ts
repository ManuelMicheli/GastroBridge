/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server";

export type PairContextOrder = {
  orderId: string;
  splitId: string;
  status: string;
  subtotal: number;
  createdAt: string;
  expectedDeliveryDate: string | null;
};

export type PairContextProduct = {
  productId: string;
  name: string;
  unit: string;
  price: number;
  unitsSold: number;
};

export type PairContext = {
  relationshipId: string;
  restaurantId: string;
  supplierId: string;
  restaurantName: string;
  supplierName: string;
  relationshipStatus: string | null;
  relationshipSince: string | null;
  activeOrders: PairContextOrder[];
  recentOrders: PairContextOrder[];
  topProducts: PairContextProduct[];
  totals: {
    openOrdersCount: number;
    openOrdersValue: number;
    last30dOrdersCount: number;
    last30dSpend: number;
  };
};

const ACTIVE_STATES = ["submitted", "confirmed", "preparing", "shipping"];
const DELIVERED_STATES = ["delivered"];

/**
 * Load the chat-context bundle for a single restaurant<->supplier pair.
 * All queries are explicitly scoped to the pair — no data from external
 * suppliers can leak into this context.
 */
export async function loadPairContext(relationshipId: string): Promise<PairContext | null> {
  const supabase = await createClient();

  const { data: rel } = await (supabase as any)
    .from("restaurant_suppliers")
    .select(
      `id, status, created_at, restaurant_id, supplier_id,
       restaurants:restaurant_id ( id, name ),
       suppliers:supplier_id ( id, company_name )`,
    )
    .eq("id", relationshipId)
    .maybeSingle() as {
      data:
        | {
            id: string;
            status: string;
            created_at: string;
            restaurant_id: string;
            supplier_id: string;
            restaurants: { id: string; name: string } | null;
            suppliers:   { id: string; company_name: string } | null;
          }
        | null;
    };

  if (!rel) return null;

  const { restaurant_id: restaurantId, supplier_id: supplierId } = rel;

  // ---------- Orders (scoped to pair via order_splits + orders) ----------
  type SplitRow = {
    id: string;
    order_id: string;
    supplier_id: string;
    subtotal: number | string;
    status: string;
    expected_delivery_date: string | null;
    orders: { id: string; restaurant_id: string; created_at: string } | null;
  };

  const { data: splits } = (await (supabase as any)
    .from("order_splits")
    .select(
      `id, order_id, supplier_id, subtotal, status, expected_delivery_date,
       orders:order_id ( id, restaurant_id, created_at )`,
    )
    .eq("supplier_id", supplierId)) as { data: SplitRow[] | null };

  const pairSplits = (splits ?? []).filter((s: SplitRow) => s.orders?.restaurant_id === restaurantId);

  const mapped: PairContextOrder[] = pairSplits.map((s: SplitRow) => ({
    orderId:              s.order_id,
    splitId:              s.id,
    status:               s.status,
    subtotal:             Number(s.subtotal ?? 0),
    createdAt:            s.orders?.created_at ?? "",
    expectedDeliveryDate: s.expected_delivery_date,
  }));

  const active = mapped
    .filter((o) => ACTIVE_STATES.includes(o.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const delivered = mapped
    .filter((o) => DELIVERED_STATES.includes(o.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const recent = mapped
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const now = Date.now();
  const last30d = mapped.filter((o) => {
    if (!o.createdAt) return false;
    const t = new Date(o.createdAt).getTime();
    return Number.isFinite(t) && now - t <= 30 * 24 * 3600 * 1000;
  });

  // ---------- Top products (scoped: products of this supplier used in pair orders) ----------
  const splitIds = pairSplits.map((s: SplitRow) => s.id);
  let topProducts: PairContextProduct[] = [];
  if (splitIds.length > 0) {
    type LineRow = { product_id: string; quantity_requested: number | string; quantity_accepted: number | string | null; unit_price: number | string };
    const { data: lines } = (await (supabase as any)
      .from("order_split_items")
      .select("product_id, quantity_requested, quantity_accepted, unit_price")
      .in("order_split_id", splitIds)) as { data: LineRow[] | null };

    const agg = new Map<string, { qty: number; last_price: number }>();
    for (const l of lines ?? []) {
      const qty = Number(l.quantity_accepted ?? l.quantity_requested ?? 0);
      const prev = agg.get(l.product_id) ?? { qty: 0, last_price: Number(l.unit_price ?? 0) };
      prev.qty += qty;
      prev.last_price = Number(l.unit_price ?? prev.last_price);
      agg.set(l.product_id, prev);
    }

    const productIds = Array.from(agg.keys());
    if (productIds.length > 0) {
      type ProdRow = { id: string; name: string; unit: string; price: number | string; supplier_id: string };
      const { data: prodRows } = (await (supabase as any)
        .from("products")
        .select("id, name, unit, price, supplier_id")
        .in("id", productIds)
        .eq("supplier_id", supplierId)) as { data: ProdRow[] | null };

      topProducts = (prodRows ?? [])
        .map((p: ProdRow) => ({
          productId: p.id,
          name:      p.name,
          unit:      p.unit,
          price:     Number(p.price ?? agg.get(p.id)?.last_price ?? 0),
          unitsSold: agg.get(p.id)?.qty ?? 0,
        }))
        .sort((a: PairContextProduct, b: PairContextProduct) => b.unitsSold - a.unitsSold)
        .slice(0, 5);
    }
  }

  return {
    relationshipId,
    restaurantId,
    supplierId,
    restaurantName:    rel.restaurants?.name ?? "Ristorante",
    supplierName:      rel.suppliers?.company_name ?? "Fornitore",
    relationshipStatus: rel.status,
    relationshipSince:  rel.created_at ?? null,
    activeOrders: active,
    recentOrders: recent,
    topProducts,
    totals: {
      openOrdersCount:    active.length,
      openOrdersValue:    active.reduce((s, o) => s + o.subtotal, 0),
      last30dOrdersCount: last30d.length,
      last30dSpend:       last30d.reduce((s, o) => s + o.subtotal, 0),
    },
  };
}

/**
 * Resolve a relationship id given a pair (restaurant, supplier) — used when
 * opening chat from anywhere that already has the IDs but not the relationship.
 * Returns null if no active/pending relationship exists.
 */
export async function resolveRelationshipIdForPair(
  restaurantId: string,
  supplierId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("restaurant_suppliers")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("supplier_id", supplierId)
    .in("status", ["active", "paused", "pending"])
    .maybeSingle() as { data: { id: string } | null };
  return data?.id ?? null;
}
