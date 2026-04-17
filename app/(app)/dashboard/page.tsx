import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RestaurantDashboard } from "@/components/dashboard/restaurant/restaurant-dashboard";
import type { SpendTrendPoint } from "@/components/dashboard/restaurant/spend-trend-chart/types";

export const metadata: Metadata = { title: "Dashboard — GastroBridge" };
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

type TrendOrderRow = { created_at: string; total: number };

const TREND_WINDOW_DAYS = 730; // covers 7D/30D/90D/YTD + previous-period delta

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSpendPoints(
  rows: TrendOrderRow[],
  windowDays: number,
): { points: SpendTrendPoint[]; transactionsByDate: Record<string, number> } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const dailyValue = new Map<string, number>();
  const dailyCount: Record<string, number> = {};

  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toISODate(d);
    dailyValue.set(key, 0);
    dailyCount[key] = 0;
  }

  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (!dailyValue.has(key)) continue;
    dailyValue.set(key, (dailyValue.get(key) ?? 0) + Number(row.total ?? 0));
    dailyCount[key] = (dailyCount[key] ?? 0) + 1;
  }

  const points: SpendTrendPoint[] = Array.from(dailyValue.entries()).map(
    ([date, value]) => ({ date, value }),
  );
  return { points, transactionsByDate: dailyCount };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", userId)
    .single<{ company_name: string }>();

  // Fetch restaurant IDs for this user
  const { data: restaurants } = (await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", userId)) as { data: { id: string }[] | null };

  const restaurantIds = restaurants?.map((r) => r.id) || [];

  // If no restaurants, return empty dashboard
  if (restaurantIds.length === 0) {
    const { points, transactionsByDate } = buildSpendPoints([], TREND_WINDOW_DAYS);
    return (
      <RestaurantDashboard
        companyName={profile?.company_name || "Ristoratore"}
        kpi={{ ordersThisMonth: 0, prevMonthOrders: 0, spending: 0, prevSpending: 0, savings: 0, activeSuppliers: 0 }}
        spendPoints={points}
        transactionsByDate={transactionsByDate}
        recentOrders={[]}
      />
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = startOfMonth;
  const trendStart = new Date();
  trendStart.setHours(0, 0, 0, 0);
  trendStart.setDate(trendStart.getDate() - (TREND_WINDOW_DAYS - 1));

  const [ordersRes, prevOrdersRes, recentOrdersRes, trendOrdersRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, status, created_at")
      .in("restaurant_id", restaurantIds)
      .gte("created_at", startOfMonth) as unknown as Promise<{ data: OrderRow[] | null }>,

    supabase
      .from("orders")
      .select("id, total")
      .in("restaurant_id", restaurantIds)
      .gte("created_at", startOfPrevMonth)
      .lt("created_at", endOfPrevMonth) as unknown as Promise<{ data: { id: string; total: number }[] | null }>,

    supabase
      .from("orders")
      .select("id, status, total, created_at")
      .in("restaurant_id", restaurantIds)
      .order("created_at", { ascending: false })
      .limit(8) as unknown as Promise<{ data: OrderRow[] | null }>,

    supabase
      .from("orders")
      .select("created_at, total")
      .in("restaurant_id", restaurantIds)
      .gte("created_at", trendStart.toISOString()) as unknown as Promise<{ data: TrendOrderRow[] | null }>,
  ]);

  const currentOrders = ordersRes.data || [];
  const prevOrders = prevOrdersRes.data || [];
  const currentOrderCount = currentOrders.length;
  const prevOrderCount = prevOrders.length;
  const currentSpending = currentOrders.reduce((s, o) => s + (o.total || 0), 0);
  const prevSpending = prevOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Count active partnerships (restaurant_suppliers with status=active).
  // Fallback to unique suppliers from order_items when the partnership table
  // is unavailable or RLS hides it, so historical orders still count.
  const { data: activeRels } = (await supabase
    .from("restaurant_suppliers")
    .select("supplier_id")
    .in("restaurant_id", restaurantIds)
    .eq("status", "active")) as { data: { supplier_id: string }[] | null };

  let uniqueSuppliers = new Set((activeRels ?? []).map((r) => r.supplier_id)).size;

  if (uniqueSuppliers === 0 && currentOrders.length > 0) {
    const { data: supplierItems } = (await supabase
      .from("order_items")
      .select("supplier_id")
      .in(
        "order_id",
        currentOrders.map((o) => o.id),
      )) as { data: { supplier_id: string }[] | null };
    uniqueSuppliers = new Set((supplierItems ?? []).map((i) => i.supplier_id)).size;
  }

  // Spend trend points (last TREND_WINDOW_DAYS days, daily)
  const { points: spendPoints, transactionsByDate } = buildSpendPoints(
    trendOrdersRes.data ?? [],
    TREND_WINDOW_DAYS,
  );

  // Recent orders
  const recentOrders = (recentOrdersRes.data || []).map((o) => ({
    id: o.id,
    status: o.status,
    total: o.total,
    created_at: o.created_at,
    supplier_name: "—",
    order_number: `#${o.id.slice(0, 8)}`,
  }));

  return (
    <RestaurantDashboard
      companyName={profile?.company_name || "Ristoratore"}
      kpi={{
        ordersThisMonth: currentOrderCount,
        prevMonthOrders: prevOrderCount,
        spending: currentSpending,
        prevSpending,
        savings: Math.round(currentSpending * 0.08),
        activeSuppliers: uniqueSuppliers,
      }}
      spendPoints={spendPoints}
      transactionsByDate={transactionsByDate}
      recentOrders={recentOrders}
    />
  );
}
