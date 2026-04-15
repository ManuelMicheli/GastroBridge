/* eslint-disable @typescript-eslint/no-explicit-any */
// Dashboard KPI + alerts queries for the supplier dashboard.
// Reads:
//   - mv_supplier_kpi_daily (Task 2, Phase 1D) → revenue/orders/customers/ticket per day
//   - mv_stock_at_risk (Phase 1B)              → lotti in scadenza
//   - order_splits, deliveries                 → pending ordini, consegne fallite
// Swallows errors: returns zero values so the dashboard never crashes on missing MVs.
import "server-only";

import { createClient } from "@/lib/supabase/server";

export type KpiDailyRow = {
  supplier_id: string;
  day: string; // ISO date (YYYY-MM-DD)
  revenue: number;
  orders_count: number;
  new_customers: number;
  avg_ticket: number;
};

export type KpiTiles = {
  // Revenue
  revenueLast14: number;
  revenuePrev14: number;
  revenueDeltaPct: number | null;
  revenueSparkline: number[]; // ultimi 14 valori (oggi incluso)
  // Orders
  ordersLast14: number;
  ordersPrev14: number;
  ordersDeltaPct: number | null;
  // Customers
  newCustomersLast14: number;
  newCustomersPrev14: number;
  customersDeltaPct: number | null;
  // Ticket medio
  avgTicketLast14: number;
  avgTicketPrev14: number;
  ticketDeltaPct: number | null;
};

export type DashboardAlerts = {
  pendingOverdueCount: number; // order_splits pending > 24h
  expiringLotsCount: number; // mv_stock_at_risk days_to_expiry <= 7
  failedDeliveriesCount: number; // deliveries failed ultima settimana
};

export type RevenueChartPoint = {
  day: string; // YYYY-MM-DD
  label: string; // dd MMM (it-IT)
  value: number;
};

export type TopClientRow = {
  restaurant_id: string;
  name: string;
  orders: number;
  revenue: number;
};

export type TopProductRow = {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
};

export type RecentDeliveryRow = {
  id: string;
  status: "planned" | "loaded" | "in_transit" | "delivered" | "failed";
  scheduled_date: string;
  delivered_at: string | null;
  restaurant_name: string;
  order_split_id: string;
};

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch KPI tiles aggregato dagli ultimi 28 giorni di mv_supplier_kpi_daily,
 * separando gli ultimi 14gg (correnti) dai 14gg precedenti (comparazione).
 */
export async function getKpiTiles(supplierId: string): Promise<KpiTiles> {
  const empty: KpiTiles = {
    revenueLast14: 0,
    revenuePrev14: 0,
    revenueDeltaPct: null,
    revenueSparkline: Array(14).fill(0),
    ordersLast14: 0,
    ordersPrev14: 0,
    ordersDeltaPct: null,
    newCustomersLast14: 0,
    newCustomersPrev14: 0,
    customersDeltaPct: null,
    avgTicketLast14: 0,
    avgTicketPrev14: 0,
    ticketDeltaPct: null,
  };

  try {
    const supabase = await createClient();

    const today = new Date();
    const start28 = new Date(today);
    start28.setDate(today.getDate() - 27); // include oggi → 28 giorni totali
    const cutoff14 = new Date(today);
    cutoff14.setDate(today.getDate() - 13);

    const { data, error } = await (supabase as any)
      .from("mv_supplier_kpi_daily")
      .select("day, revenue, orders_count, new_customers, avg_ticket")
      .eq("supplier_id", supplierId)
      .gte("day", isoDate(start28))
      .lte("day", isoDate(today))
      .order("day", { ascending: true });

    if (error) return empty;
    const rows = (data ?? []) as Array<{
      day: string;
      revenue: number | null;
      orders_count: number | null;
      new_customers: number | null;
      avg_ticket: number | null;
    }>;

    const byDay = new Map<string, (typeof rows)[number]>();
    for (const r of rows) byDay.set(r.day, r);

    // Sparkline: 14 giorni, dal piu vecchio al piu recente (oggi ultimo).
    const sparkline: number[] = [];
    let revenueLast14 = 0;
    let ordersLast14 = 0;
    let newCustomersLast14 = 0;
    let ticketSumLast14 = 0;
    let ticketCountLast14 = 0;
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = isoDate(d);
      const row = byDay.get(key);
      const rev = Number(row?.revenue ?? 0);
      sparkline.push(rev);
      revenueLast14 += rev;
      ordersLast14 += Number(row?.orders_count ?? 0);
      newCustomersLast14 += Number(row?.new_customers ?? 0);
      if (row && row.avg_ticket != null) {
        ticketSumLast14 += Number(row.avg_ticket);
        ticketCountLast14 += 1;
      }
    }

    let revenuePrev14 = 0;
    let ordersPrev14 = 0;
    let newCustomersPrev14 = 0;
    let ticketSumPrev14 = 0;
    let ticketCountPrev14 = 0;
    for (let i = 27; i >= 14; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = isoDate(d);
      const row = byDay.get(key);
      revenuePrev14 += Number(row?.revenue ?? 0);
      ordersPrev14 += Number(row?.orders_count ?? 0);
      newCustomersPrev14 += Number(row?.new_customers ?? 0);
      if (row && row.avg_ticket != null) {
        ticketSumPrev14 += Number(row.avg_ticket);
        ticketCountPrev14 += 1;
      }
    }

    const avgTicketLast14 = ticketCountLast14 > 0 ? ticketSumLast14 / ticketCountLast14 : 0;
    const avgTicketPrev14 = ticketCountPrev14 > 0 ? ticketSumPrev14 / ticketCountPrev14 : 0;

    // Unused cutoff14 placeholder (reserved for future per-day splits).
    void cutoff14;

    return {
      revenueLast14,
      revenuePrev14,
      revenueDeltaPct: pctDelta(revenueLast14, revenuePrev14),
      revenueSparkline: sparkline,
      ordersLast14,
      ordersPrev14,
      ordersDeltaPct: pctDelta(ordersLast14, ordersPrev14),
      newCustomersLast14,
      newCustomersPrev14,
      customersDeltaPct: pctDelta(newCustomersLast14, newCustomersPrev14),
      avgTicketLast14,
      avgTicketPrev14,
      ticketDeltaPct: pctDelta(avgTicketLast14, avgTicketPrev14),
    };
  } catch {
    return empty;
  }
}

/**
 * Conta alert dashboard: ordini pending > 24h, lotti in scadenza, consegne fallite.
 */
export async function getDashboardAlerts(supplierId: string): Promise<DashboardAlerts> {
  const supabase = await createClient();

  // 1. Pending > 24h (order_splits.created_at piu di 24h fa, status pending/submitted)
  let pendingOverdueCount = 0;
  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    const { count } = await (supabase as any)
      .from("order_splits")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .in("status", ["submitted", "pending"])
      .lt("created_at", cutoff.toISOString());
    pendingOverdueCount = count ?? 0;
  } catch {
    pendingOverdueCount = 0;
  }

  // 2. Lotti in scadenza ≤ 7gg
  let expiringLotsCount = 0;
  try {
    const { data } = await (supabase as any)
      .from("mv_stock_at_risk")
      .select("lot_id")
      .eq("supplier_id", supplierId)
      .lte("days_to_expiry", 7);
    if (Array.isArray(data)) {
      expiringLotsCount = new Set(
        (data as Array<{ lot_id: string }>).map((r) => r.lot_id),
      ).size;
    }
  } catch {
    expiringLotsCount = 0;
  }

  // 3. Consegne fallite ultima settimana — join via order_splits
  let failedDeliveriesCount = 0;
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data } = await (supabase as any)
      .from("deliveries")
      .select("id, order_split_id, status, delivered_at, created_at, order_splits!inner(supplier_id)")
      .eq("order_splits.supplier_id", supplierId)
      .eq("status", "failed")
      .gte("created_at", weekAgo.toISOString());
    failedDeliveriesCount = Array.isArray(data) ? data.length : 0;
  } catch {
    failedDeliveriesCount = 0;
  }

  return {
    pendingOverdueCount,
    expiringLotsCount,
    failedDeliveriesCount,
  };
}

/**
 * Revenue chart ultimi 30 giorni (oggi incluso). Pad dei giorni mancanti a 0.
 * Etichetta in it-IT (es. "14 apr").
 */
export async function getRevenueChart30Days(
  supplierId: string,
): Promise<RevenueChartPoint[]> {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29); // 30 giorni incluso oggi

  // Pre-build 30 days padded to 0
  const days: RevenueChartPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = isoDate(d);
    const label = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
    days.push({ day: key, label, value: 0 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("mv_supplier_kpi_daily")
      .select("day, revenue")
      .eq("supplier_id", supplierId)
      .gte("day", isoDate(start))
      .lte("day", isoDate(today));

    if (error || !Array.isArray(data)) return days;

    const byDay = new Map<string, number>();
    for (const r of data as Array<{ day: string; revenue: number | null }>) {
      byDay.set(r.day, Number(r.revenue ?? 0));
    }
    for (const p of days) {
      if (byDay.has(p.day)) p.value = byDay.get(p.day)!;
    }
    return days;
  } catch {
    return days;
  }
}

/**
 * Top 5 ristoranti per revenue nel mese corrente (o in `month` = YYYY-MM-01).
 */
export async function getTopClients(
  supplierId: string,
  opts: { month?: Date } = {},
): Promise<TopClientRow[]> {
  try {
    const supabase = await createClient();
    const now = opts.month ?? new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Pull all splits joined to orders for this supplier in current month
    const { data, error } = await (supabase as any)
      .from("order_splits")
      .select("id, subtotal, status, orders!inner(id, restaurant_id, created_at)")
      .eq("supplier_id", supplierId)
      .in("status", ["confirmed", "preparing", "shipping", "delivered"])
      .gte("orders.created_at", startOfMonth.toISOString())
      .lt("orders.created_at", startOfNextMonth.toISOString());

    if (error || !Array.isArray(data)) return [];

    const rows = data as Array<{
      id: string;
      subtotal: number | null;
      orders: { id: string; restaurant_id: string; created_at: string } | null;
    }>;

    const byRestaurant = new Map<string, { orders: number; revenue: number }>();
    for (const r of rows) {
      const rid = r.orders?.restaurant_id;
      if (!rid) continue;
      const curr = byRestaurant.get(rid) ?? { orders: 0, revenue: 0 };
      curr.orders += 1;
      curr.revenue += Number(r.subtotal ?? 0);
      byRestaurant.set(rid, curr);
    }

    const restaurantIds = [...byRestaurant.keys()];
    if (restaurantIds.length === 0) return [];

    const { data: rests } = await (supabase as any)
      .from("restaurants")
      .select("id, name")
      .in("id", restaurantIds);

    const nameById = new Map<string, string>();
    for (const r of (rests ?? []) as Array<{ id: string; name: string }>) {
      nameById.set(r.id, r.name);
    }

    return [...byRestaurant.entries()]
      .map(([restaurant_id, v]) => ({
        restaurant_id,
        name: nameById.get(restaurant_id) ?? "—",
        orders: v.orders,
        revenue: v.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Top 5 prodotti per revenue nel mese corrente, via order_split_items.
 */
export async function getTopProducts(
  supplierId: string,
  opts: { month?: Date } = {},
): Promise<TopProductRow[]> {
  try {
    const supabase = await createClient();
    const now = opts.month ?? new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // 1. Get relevant split IDs for this supplier in the month.
    const { data: splits } = await (supabase as any)
      .from("order_splits")
      .select("id, orders!inner(created_at)")
      .eq("supplier_id", supplierId)
      .in("status", ["confirmed", "preparing", "shipping", "delivered"])
      .gte("orders.created_at", startOfMonth.toISOString())
      .lt("orders.created_at", startOfNextMonth.toISOString());

    const splitIds = Array.isArray(splits)
      ? (splits as Array<{ id: string }>).map((s) => s.id)
      : [];

    if (splitIds.length === 0) return [];

    const { data: items } = await (supabase as any)
      .from("order_split_items")
      .select("product_id, quantity_requested, quantity_accepted, unit_price")
      .in("order_split_id", splitIds);

    if (!Array.isArray(items)) return [];

    const byProduct = new Map<string, { quantity: number; revenue: number }>();
    for (const it of items as Array<{
      product_id: string;
      quantity_requested: number | null;
      quantity_accepted: number | null;
      unit_price: number | null;
    }>) {
      const qty = Number(it.quantity_accepted ?? it.quantity_requested ?? 0);
      const price = Number(it.unit_price ?? 0);
      const curr = byProduct.get(it.product_id) ?? { quantity: 0, revenue: 0 };
      curr.quantity += qty;
      curr.revenue += qty * price;
      byProduct.set(it.product_id, curr);
    }

    const productIds = [...byProduct.keys()];
    if (productIds.length === 0) return [];

    const { data: prods } = await (supabase as any)
      .from("products")
      .select("id, name")
      .in("id", productIds);

    const nameById = new Map<string, string>();
    for (const p of (prods ?? []) as Array<{ id: string; name: string }>) {
      nameById.set(p.id, p.name);
    }

    return [...byProduct.entries()]
      .map(([product_id, v]) => ({
        product_id,
        name: nameById.get(product_id) ?? "—",
        quantity: v.quantity,
        revenue: v.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Ultime N consegne con status + nome ristorante.
 * Ordina per delivered_at desc (fallback scheduled_date desc, created_at desc).
 */
export async function getRecentDeliveries(
  supplierId: string,
  opts: { limit?: number } = {},
): Promise<RecentDeliveryRow[]> {
  const limit = opts.limit ?? 8;
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("deliveries")
      .select(
        "id, order_split_id, status, scheduled_date, delivered_at, created_at, order_splits!inner(id, supplier_id, orders!inner(id, restaurant_id))",
      )
      .eq("order_splits.supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(limit * 3); // sovradimensiona per compensare il ri-ordinamento lato client

    if (error || !Array.isArray(data)) return [];

    const rows = data as Array<{
      id: string;
      order_split_id: string;
      status: RecentDeliveryRow["status"];
      scheduled_date: string;
      delivered_at: string | null;
      created_at: string;
      order_splits: { orders: { restaurant_id: string } | null } | null;
    }>;

    // Preferisci delivered_at, poi scheduled_date, poi created_at per ordinamento recency
    const sorted = [...rows].sort((a, b) => {
      const ta = a.delivered_at ?? a.scheduled_date ?? a.created_at;
      const tb = b.delivered_at ?? b.scheduled_date ?? b.created_at;
      return tb.localeCompare(ta);
    });

    const restaurantIds = [
      ...new Set(
        sorted
          .map((r) => r.order_splits?.orders?.restaurant_id)
          .filter((x): x is string => !!x),
      ),
    ];

    const nameById = new Map<string, string>();
    if (restaurantIds.length > 0) {
      const { data: rests } = await (supabase as any)
        .from("restaurants")
        .select("id, name")
        .in("id", restaurantIds);
      for (const r of (rests ?? []) as Array<{ id: string; name: string }>) {
        nameById.set(r.id, r.name);
      }
    }

    return sorted.slice(0, limit).map((r) => ({
      id: r.id,
      status: r.status,
      scheduled_date: r.scheduled_date,
      delivered_at: r.delivered_at,
      order_split_id: r.order_split_id,
      restaurant_name:
        nameById.get(r.order_splits?.orders?.restaurant_id ?? "") ?? "—",
    }));
  } catch {
    return [];
  }
}
