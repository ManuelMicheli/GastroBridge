import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { RestaurantDashboard } from "@/components/dashboard/restaurant/restaurant-dashboard";

export const metadata: Metadata = { title: "Dashboard — GastroBridge" };

type OrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

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
    return (
      <RestaurantDashboard
        companyName={profile?.company_name || "Ristoratore"}
        kpi={{ ordersThisMonth: 0, prevMonthOrders: 0, spending: 0, prevSpending: 0, savings: 0, activeSuppliers: 0 }}
        spendingSparkline={[0, 0, 0, 0, 0, 0, 0]}
        chartData={[]}
        recentOrders={[]}
      />
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = startOfMonth;

  const [ordersRes, prevOrdersRes, recentOrdersRes] = await Promise.all([
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
  ]);

  const currentOrders = ordersRes.data || [];
  const prevOrders = prevOrdersRes.data || [];
  const currentOrderCount = currentOrders.length;
  const prevOrderCount = prevOrders.length;
  const currentSpending = currentOrders.reduce((s, o) => s + (o.total || 0), 0);
  const prevSpending = prevOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Sparkline (last 14 days)
  const sparklineMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sparklineMap[d.toISOString().slice(0, 10)] = 0;
  }
  currentOrders.forEach((o) => {
    const day = o.created_at?.slice(0, 10);
    if (day && sparklineMap[day] !== undefined) {
      sparklineMap[day] += o.total || 0;
    }
  });
  const spendingSparkline = Object.values(sparklineMap);

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

  // Chart data (last 30 days)
  const chartData: Array<{ label: string; value: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayTotal = currentOrders
      .filter((o) => o.created_at?.slice(0, 10) === key)
      .reduce((s, o) => s + (o.total || 0), 0);
    chartData.push({
      label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      value: dayTotal,
    });
  }

  // Recent orders
  const recentOrders = (recentOrdersRes.data || []).map((o) => ({
    id: o.id,
    status: o.status,
    total: o.total,
    created_at: o.created_at,
    supplier_name: "—",
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
      spendingSparkline={spendingSparkline}
      chartData={chartData}
      recentOrders={recentOrders}
    />
  );
}
