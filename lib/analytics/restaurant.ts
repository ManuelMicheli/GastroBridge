import "server-only";

import { createClient } from "@/lib/supabase/server";

export type RestaurantAnalytics = {
  currentMonthSpending: number;
  prevMonthSpending: number;
  currentOrderCount: number;
  prevOrderCount: number;
  avgTicket: number;
  monthlyTrend: Array<{ label: string; value: number }>;
  spendingSparkline: number[];
  supplierBreakdown: Array<{ name: string; spending: number; orderCount: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  recentOrders: Array<{
    id: string;
    total: number;
    status: string;
    created_at: string;
    supplier_count: number;
    item_count: number;
  }>;
};

const EMPTY: RestaurantAnalytics = {
  currentMonthSpending: 0,
  prevMonthSpending: 0,
  currentOrderCount: 0,
  prevOrderCount: 0,
  avgTicket: 0,
  monthlyTrend: [],
  spendingSparkline: [],
  supplierBreakdown: [],
  statusDistribution: [],
  recentOrders: [],
};

type OrderRow = {
  id: string;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

const SUPPLIER_HEADER_RE = /---\s*([^()]+?)\s*\(([\d.,]+)\s*€\)\s*---/g;
const ITEM_LINE_RE = /^\s+\d+(?:[.,]\d+)?×/gm;

function parseSupplierBreakdown(notes: string | null): Array<{ name: string; subtotal: number }> {
  if (!notes) return [];
  const results: Array<{ name: string; subtotal: number }> = [];
  for (const match of notes.matchAll(SUPPLIER_HEADER_RE)) {
    const name = match[1]?.trim() ?? "";
    const amountRaw = match[2]?.replace(/\./g, "").replace(",", ".") ?? "0";
    const subtotal = parseFloat(amountRaw);
    if (name && Number.isFinite(subtotal)) {
      results.push({ name, subtotal });
    }
  }
  return results;
}

function countItems(notes: string | null): number {
  if (!notes) return 0;
  return (notes.match(ITEM_LINE_RE) ?? []).length;
}

export async function getRestaurantAnalytics(): Promise<RestaurantAnalytics> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const { data: restaurants } = (await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)) as { data: { id: string }[] | null };

  const restaurantIds = restaurants?.map((r) => r.id) ?? [];
  if (restaurantIds.length === 0) return EMPTY;

  const now = new Date();
  const startOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOf12MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data: allOrdersRaw } = (await supabase
    .from("orders")
    .select("id, total, status, notes, created_at")
    .in("restaurant_id", restaurantIds)
    .gte("created_at", startOf12MonthsAgo.toISOString())
    .order("created_at", { ascending: false })) as { data: OrderRow[] | null };

  const allOrders = allOrdersRaw ?? [];

  const currentOrders = allOrders.filter((o) => new Date(o.created_at) >= startOfCurrent);
  const prevOrders = allOrders.filter(
    (o) => new Date(o.created_at) >= startOfPrev && new Date(o.created_at) < startOfCurrent,
  );

  const currentMonthSpending = currentOrders.reduce((s, o) => s + (o.total || 0), 0);
  const prevMonthSpending = prevOrders.reduce((s, o) => s + (o.total || 0), 0);
  const avgTicket = currentOrders.length > 0 ? currentMonthSpending / currentOrders.length : 0;

  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }
  for (const o of allOrders) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (o.total || 0));
    }
  }
  const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const monthlyTrend = Array.from(monthlyMap.entries()).map(([key, value]) => {
    const [, monthStr] = key.split("-");
    const monthIdx = parseInt(monthStr ?? "1", 10) - 1;
    return { label: monthNames[monthIdx] ?? key, value };
  });

  const sparklineMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sparklineMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of allOrders) {
    const key = o.created_at.slice(0, 10);
    if (sparklineMap.has(key)) {
      sparklineMap.set(key, (sparklineMap.get(key) ?? 0) + (o.total || 0));
    }
  }
  const spendingSparkline = Array.from(sparklineMap.values());

  const supplierAgg = new Map<string, { spending: number; orderCount: number }>();
  for (const o of currentOrders) {
    const breakdown = parseSupplierBreakdown(o.notes);
    for (const b of breakdown) {
      const existing = supplierAgg.get(b.name) ?? { spending: 0, orderCount: 0 };
      existing.spending += b.subtotal;
      existing.orderCount += 1;
      supplierAgg.set(b.name, existing);
    }
  }
  const supplierBreakdown = Array.from(supplierAgg.entries())
    .map(([name, v]) => ({ name, spending: v.spending, orderCount: v.orderCount }))
    .sort((a, b) => b.spending - a.spending);

  const statusMap = new Map<string, number>();
  for (const o of currentOrders) {
    statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  }
  const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  const recentOrders = allOrders.slice(0, 8).map((o) => {
    const breakdown = parseSupplierBreakdown(o.notes);
    return {
      id: o.id,
      total: o.total || 0,
      status: o.status,
      created_at: o.created_at,
      supplier_count: breakdown.length,
      item_count: countItems(o.notes),
    };
  });

  return {
    currentMonthSpending,
    prevMonthSpending,
    currentOrderCount: currentOrders.length,
    prevOrderCount: prevOrders.length,
    avgTicket,
    monthlyTrend,
    spendingSparkline,
    supplierBreakdown,
    statusDistribution,
    recentOrders,
  };
}
