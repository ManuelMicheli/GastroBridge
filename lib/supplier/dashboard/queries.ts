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
