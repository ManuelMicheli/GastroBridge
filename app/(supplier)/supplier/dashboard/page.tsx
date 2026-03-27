import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SupplierDashboard } from "@/components/dashboard/supplier/supplier-dashboard";

export const metadata: Metadata = { title: "Dashboard Fornitore — GastroBridge" };

type SplitRow = { id: string; order_id: string; subtotal: number; status: string };
type OrderRow = { id: string; created_at: string; restaurant_id: string };
type RestaurantRow = { id: string; name: string };
type ProductRow = { id: string; name: string };

export default async function SupplierDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_name")
    .eq("id", userId)
    .single<{ company_name: string }>();

  const { data: supplier } = (await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", userId)
    .single()) as { data: { id: string } | null };

  const supplierId = supplier?.id;

  // No supplier record — empty dashboard
  if (!supplierId) {
    return (
      <SupplierDashboard
        companyName={profile?.company_name || "Fornitore"}
        kpi={{ ordersToday: 0, monthlyRevenue: 0, prevRevenue: 0, activeClients: 0, activeProducts: 0 }}
        revenueSparkline={[0, 0, 0, 0, 0, 0, 0]}
        chartData={[]}
        recentOrders={[]}
        topProducts={[]}
        topClients={[]}
      />
    );
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = startOfMonth;

  // Fetch all splits for this supplier + products
  const [splitsRes, productsRes] = await Promise.all([
    supabase
      .from("order_splits")
      .select("id, order_id, subtotal, status")
      .eq("supplier_id", supplierId) as unknown as Promise<{ data: SplitRow[] | null }>,

    supabase
      .from("products")
      .select("id, name")
      .eq("supplier_id", supplierId)
      .eq("is_available", true) as unknown as Promise<{ data: ProductRow[] | null }>,
  ]);

  const allSplits = splitsRes.data || [];
  const products = productsRes.data || [];

  // Get related orders for timestamps
  const orderIds = [...new Set(allSplits.map((s) => s.order_id))];

  let ordersMap = new Map<string, OrderRow>();
  let restaurantMap = new Map<string, string>();

  if (orderIds.length > 0) {
    const { data: relatedOrders } = (await supabase
      .from("orders")
      .select("id, created_at, restaurant_id")
      .in("id", orderIds)) as { data: OrderRow[] | null };

    ordersMap = new Map((relatedOrders || []).map((o) => [o.id, o]));

    const restIds = [...new Set((relatedOrders || []).map((o) => o.restaurant_id))];
    if (restIds.length > 0) {
      const { data: rests } = (await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", restIds)) as { data: RestaurantRow[] | null };

      restaurantMap = new Map((rests || []).map((r) => [r.id, r.name]));
    }
  }

  // Filter by time
  const monthFiltered = allSplits.filter((s) => {
    const o = ordersMap.get(s.order_id);
    return o && o.created_at >= startOfMonth;
  });

  const todayFiltered = monthFiltered.filter((s) => {
    const o = ordersMap.get(s.order_id);
    return o && o.created_at >= todayStart;
  });

  const prevFiltered = allSplits.filter((s) => {
    const o = ordersMap.get(s.order_id);
    return o && o.created_at >= startOfPrevMonth && o.created_at < endOfPrevMonth;
  });

  const monthlyRevenue = monthFiltered.reduce((s, o) => s + (o.subtotal || 0), 0);
  const prevRevenue = prevFiltered.reduce((s, o) => s + (o.subtotal || 0), 0);

  // Unique clients
  const clientSet = new Set<string>();
  monthFiltered.forEach((s) => {
    const o = ordersMap.get(s.order_id);
    if (o) {
      const name = restaurantMap.get(o.restaurant_id);
      if (name) clientSet.add(name);
    }
  });

  // Sparkline (14 days)
  const sparklineMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sparklineMap[d.toISOString().slice(0, 10)] = 0;
  }
  monthFiltered.forEach((s) => {
    const day = ordersMap.get(s.order_id)?.created_at?.slice(0, 10);
    if (day && sparklineMap[day] !== undefined) sparklineMap[day] += s.subtotal || 0;
  });

  // Chart (30 days)
  const chartData: Array<{ label: string; value: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayTotal = monthFiltered
      .filter((s) => ordersMap.get(s.order_id)?.created_at?.slice(0, 10) === key)
      .reduce((sum, s) => sum + (s.subtotal || 0), 0);
    chartData.push({
      label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      value: dayTotal,
    });
  }

  // Recent orders (last 8 splits by order date)
  const sortedSplits = [...allSplits].sort((a, b) => {
    const ta = ordersMap.get(a.order_id)?.created_at || "";
    const tb = ordersMap.get(b.order_id)?.created_at || "";
    return tb.localeCompare(ta);
  });

  const recentOrders = sortedSplits.slice(0, 8).map((s) => {
    const o = ordersMap.get(s.order_id);
    return {
      id: s.id,
      status: s.status,
      total: s.subtotal || 0,
      created_at: o?.created_at || "",
      restaurant_name: o ? restaurantMap.get(o.restaurant_id) || "—" : "—",
    };
  });

  // Top products placeholder
  const topProducts = products.slice(0, 5).map((p, i) => ({
    label: p.name,
    value: Math.max(10 - i * 2, 1),
    subtitle: `${Math.max(10 - i * 2, 1)} ordini`,
  }));

  // Top clients
  const clientTotals = new Map<string, { orders: number; total: number }>();
  monthFiltered.forEach((s) => {
    const o = ordersMap.get(s.order_id);
    if (!o) return;
    const name = restaurantMap.get(o.restaurant_id);
    if (!name) return;
    const existing = clientTotals.get(name) || { orders: 0, total: 0 };
    existing.orders += 1;
    existing.total += s.subtotal || 0;
    clientTotals.set(name, existing);
  });

  const topClients = Array.from(clientTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([name, data]) => ({ name, ...data }));

  return (
    <SupplierDashboard
      companyName={profile?.company_name || "Fornitore"}
      kpi={{
        ordersToday: todayFiltered.length,
        monthlyRevenue,
        prevRevenue,
        activeClients: clientSet.size,
        activeProducts: products.length,
      }}
      revenueSparkline={Object.values(sparklineMap)}
      chartData={chartData}
      recentOrders={recentOrders}
      topProducts={topProducts}
      topClients={topClients}
    />
  );
}
