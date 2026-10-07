// Supplier analytics (/supplier/analytics): KPIs, daily revenue vs previous
// period, top clients and top products for a `?period=` range.
//
// Built on the supplier dashboard helpers (lib/supplier/dashboard/queries.ts):
// same revenue definition as the dashboard and mv_supplier_kpi_daily — splits
// in confirmed / preparing / shipping / delivered, dated by orders.created_at,
// summed on order_splits.subtotal. Reads go through the user client, so RLS
// (supplier membership) still applies.
import "server-only";

import { computePeriodRange, type PeriodKey } from "@/lib/analytics/period";
import {
  getRevenueSplits,
  getTopClients,
  getTopProducts,
  type RevenueSplitRow,
  type TopClientRow,
  type TopProductRow,
} from "@/lib/supplier/dashboard/queries";

export type SupplierTrendPoint = {
  date: string; // YYYY-MM-DD (Europe/Rome)
  spend: number; // revenue of the day (named `spend` to fit the shared chart)
  orders: number;
  clients: number; // distinct restaurants that ordered that day
  prevSpend: number | null; // same day-offset in the previous period
};

export type SupplierAnalytics = {
  period: { key: PeriodKey; label: string };
  revenue: number;
  previousRevenue: number;
  orders: number;
  previousOrders: number;
  avgTicket: number;
  previousAvgTicket: number;
  activeClients: number;
  previousActiveClients: number;
  daily: SupplierTrendPoint[];
  topClients: TopClientRow[];
  topProducts: TopProductRow[];
};

const DAY_MS = 86_400_000;
const romeDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of an instant, in Italian time. */
function dayKey(d: Date): string {
  return romeDay.format(d);
}

/** Calendar date of a period boundary (computePeriodRange builds local midnights). */
function boundaryKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Calendar days [from, to) as YYYY-MM-DD keys (noon UTC anchor avoids DST edges). */
function dayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const first = boundaryKey(from);
  const end = boundaryKey(to); // exclusive
  let cursor = new Date(`${first}T12:00:00Z`);
  for (let i = 0; i < 400; i++) {
    const k = cursor.toISOString().slice(0, 10);
    if (k >= end) break;
    keys.push(k);
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return keys;
}

function summarize(rows: RevenueSplitRow[]) {
  const revenue = rows.reduce((s, r) => s + r.subtotal, 0);
  const orders = rows.length;
  return {
    revenue,
    orders,
    avgTicket: orders > 0 ? revenue / orders : 0,
    clients: new Set(rows.map((r) => r.restaurant_id)).size,
  };
}

export async function getSupplierAnalytics(
  supplierId: string,
  periodKey: PeriodKey,
  now: Date = new Date(),
): Promise<SupplierAnalytics> {
  const range = computePeriodRange(periodKey, now);

  const [splits, topClients, topProducts] = await Promise.all([
    // Current + previous period in one read.
    getRevenueSplits(supplierId, { from: range.previous.from, to: range.to }),
    getTopClients(supplierId, { range: { from: range.from, to: range.to }, limit: 6 }),
    getTopProducts(supplierId, { range: { from: range.from, to: range.to }, limit: 8 }),
  ]);

  const fromMs = range.from.getTime();
  const current = splits.filter((s) => new Date(s.created_at).getTime() >= fromMs);
  const previous = splits.filter((s) => new Date(s.created_at).getTime() < fromMs);
  const cur = summarize(current);
  const prev = summarize(previous);

  // Daily series: current period up to today, aligned with the previous one.
  const curByDay = new Map<string, { spend: number; orders: number; clients: Set<string> }>();
  for (const s of current) {
    const k = dayKey(new Date(s.created_at));
    const cell = curByDay.get(k) ?? { spend: 0, orders: 0, clients: new Set<string>() };
    cell.spend += s.subtotal;
    cell.orders += 1;
    cell.clients.add(s.restaurant_id);
    curByDay.set(k, cell);
  }
  const prevByDay = new Map<string, number>();
  for (const s of previous) {
    const k = dayKey(new Date(s.created_at));
    prevByDay.set(k, (prevByDay.get(k) ?? 0) + s.subtotal);
  }

  const today = dayKey(now);
  const currentDays = dayKeys(range.from, range.to).filter((k) => k <= today);
  const previousDays = dayKeys(range.previous.from, range.previous.to);
  const daily: SupplierTrendPoint[] = currentDays.map((k, i) => {
    const cell = curByDay.get(k);
    const pk = previousDays[i];
    return {
      date: k,
      spend: cell?.spend ?? 0,
      orders: cell?.orders ?? 0,
      clients: cell?.clients.size ?? 0,
      prevSpend: pk !== undefined ? prevByDay.get(pk) ?? 0 : null,
    };
  });

  return {
    period: { key: range.key, label: range.label },
    revenue: cur.revenue,
    previousRevenue: prev.revenue,
    orders: cur.orders,
    previousOrders: prev.orders,
    avgTicket: cur.avgTicket,
    previousAvgTicket: prev.avgTicket,
    activeClients: cur.clients,
    previousActiveClients: prev.clients,
    daily,
    topClients,
    topProducts,
  };
}
