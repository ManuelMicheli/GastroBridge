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

type TrendOrderRow = { id: string; created_at: string; total: number };

type VatItemRow = {
  order_id: string;
  subtotal: number;
  products: { tax_rate: number | null } | null;
};

const TREND_WINDOW_DAYS = 730; // covers 7D/30D/90D/YTD + previous-period delta
const DEFAULT_VAT_RATE = 10; // fallback when order has no item-level tax data (catalog orders)

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeVatByOrder(items: VatItemRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    const rate = Number(it.products?.tax_rate ?? DEFAULT_VAT_RATE);
    const vat = (Number(it.subtotal ?? 0) * rate) / 100;
    out.set(it.order_id, (out.get(it.order_id) ?? 0) + vat);
  }
  return out;
}

function grossFor(
  orderId: string,
  netTotal: number,
  vatByOrder: Map<string, number>,
): number {
  const vat = vatByOrder.get(orderId);
  if (vat !== undefined) return netTotal + vat;
  return netTotal * (1 + DEFAULT_VAT_RATE / 100);
}

function buildSpendPoints(
  rows: TrendOrderRow[],
  windowDays: number,
  vatByOrder: Map<string, number>,
): {
  points: SpendTrendPoint[];
  pointsGross: SpendTrendPoint[];
  transactionsByDate: Record<string, number>;
} {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));

  const dailyValue = new Map<string, number>();
  const dailyValueGross = new Map<string, number>();
  const dailyCount: Record<string, number> = {};

  for (let i = 0; i < windowDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toISODate(d);
    dailyValue.set(key, 0);
    dailyValueGross.set(key, 0);
    dailyCount[key] = 0;
  }

  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (!dailyValue.has(key)) continue;
    const net = Number(row.total ?? 0);
    const gross = grossFor(row.id, net, vatByOrder);
    dailyValue.set(key, (dailyValue.get(key) ?? 0) + net);
    dailyValueGross.set(key, (dailyValueGross.get(key) ?? 0) + gross);
    dailyCount[key] = (dailyCount[key] ?? 0) + 1;
  }

  const points: SpendTrendPoint[] = Array.from(dailyValue.entries()).map(
    ([date, value]) => ({ date, value }),
  );
  const pointsGross: SpendTrendPoint[] = Array.from(dailyValueGross.entries()).map(
    ([date, value]) => ({ date, value }),
  );
  return { points, pointsGross, transactionsByDate: dailyCount };
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
    const { points, pointsGross, transactionsByDate } = buildSpendPoints(
      [],
      TREND_WINDOW_DAYS,
      new Map(),
    );
    return (
      <RestaurantDashboard
        companyName={profile?.company_name || "Ristoratore"}
        kpi={{
          ordersThisMonth: 0,
          prevMonthOrders: 0,
          spending: 0,
          spendingGross: 0,
          prevSpending: 0,
          prevSpendingGross: 0,
          savings: 0,
          savingsGross: 0,
          activeSuppliers: 0,
        }}
        fiscal={{
          enabled: false,
          revenueCents: 0,
          foodCostPct: null,
          receipts: 0,
          covers: 0,
          restaurantId: null,
          revenueSpark: [],
          receiptsSpark: [],
          coversSpark: [],
          foodCostSpark: [],
        }}
        spendPoints={points}
        spendPointsGross={pointsGross}
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
      .select("id, created_at, total")
      .in("restaurant_id", restaurantIds)
      .gte("created_at", trendStart.toISOString()) as unknown as Promise<{ data: TrendOrderRow[] | null }>,
  ]);

  const currentOrders = ordersRes.data || [];
  const prevOrders = prevOrdersRes.data || [];
  const currentOrderCount = currentOrders.length;
  const prevOrderCount = prevOrders.length;
  const currentSpending = currentOrders.reduce((s, o) => s + (o.total || 0), 0);
  const prevSpending = prevOrders.reduce((s, o) => s + (o.total || 0), 0);

  // Fetch order_items joined with products.tax_rate for every order we display,
  // so we can compute a gross (IVA-inclusive) variant alongside the stored net
  // totals and let the user toggle between views.
  const vatOrderIds = Array.from(
    new Set<string>([
      ...currentOrders.map((o) => o.id),
      ...prevOrders.map((o) => o.id),
      ...(recentOrdersRes.data ?? []).map((o) => o.id),
      ...(trendOrdersRes.data ?? []).map((o) => o.id),
    ]),
  );

  let vatByOrder = new Map<string, number>();
  if (vatOrderIds.length > 0) {
    const { data: vatItems } = (await supabase
      .from("order_items")
      .select("order_id, subtotal, products(tax_rate)")
      .in("order_id", vatOrderIds)) as { data: VatItemRow[] | null };
    vatByOrder = computeVatByOrder(vatItems ?? []);
  }

  const currentSpendingGross = currentOrders.reduce(
    (s, o) => s + grossFor(o.id, o.total || 0, vatByOrder),
    0,
  );
  const prevSpendingGross = prevOrders.reduce(
    (s, o) => s + grossFor(o.id, o.total || 0, vatByOrder),
    0,
  );

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
  const { points: spendPoints, pointsGross: spendPointsGross, transactionsByDate } =
    buildSpendPoints(trendOrdersRes.data ?? [], TREND_WINDOW_DAYS, vatByOrder);

  // Fiscal aggregates (Cassetto Fiscale) for the dashboard summary — last 30
  // days across every restaurant that has fiscal_enabled=true. When no sede
  // is enabled we return a placeholder so the card can show the activation CTA.
  const { data: prefsRows } = (await supabase
    .from("restaurant_preferences")
    .select("restaurant_id, fiscal_enabled")
    .in("restaurant_id", restaurantIds)) as {
    data: { restaurant_id: string; fiscal_enabled: boolean | null }[] | null;
  };
  const fiscalEnabledIds = (prefsRows ?? [])
    .filter((r) => r.fiscal_enabled)
    .map((r) => r.restaurant_id);

  const primaryRestaurantId = restaurantIds[0] ?? null;

  let fiscal: {
    enabled: boolean;
    revenueCents: number;
    foodCostPct: number | null;
    receipts: number;
    covers: number;
    restaurantId: string | null;
    revenueSpark: number[];
    receiptsSpark: number[];
    coversSpark: number[];
    foodCostSpark: number[];
  };

  if (fiscalEnabledIds.length > 0) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    const sinceIso = sinceDate.toISOString().slice(0, 10);

    const [dailyRes, foodCostRes] = await Promise.all([
      supabase
        .from("fiscal_daily_summary")
        .select("revenue_cents, receipts_count, covers, business_day")
        .in("restaurant_id", fiscalEnabledIds)
        .gte("business_day", sinceIso) as unknown as Promise<{
        data: {
          revenue_cents: number;
          receipts_count: number;
          covers: number;
          business_day: string;
        }[] | null;
      }>,
      supabase
        .from("fiscal_food_cost")
        .select("food_cost_pct, business_day")
        .in("restaurant_id", fiscalEnabledIds)
        .gte("business_day", sinceIso)
        .order("business_day", { ascending: true }) as unknown as Promise<{
        data: { food_cost_pct: number | null; business_day: string }[] | null;
      }>,
    ]);

    const dailyRows = dailyRes.data ?? [];
    const revenueCents = dailyRows.reduce(
      (s, r) => s + (r.revenue_cents || 0),
      0,
    );
    const receipts = dailyRows.reduce(
      (s, r) => s + (r.receipts_count || 0),
      0,
    );
    const covers = dailyRows.reduce((s, r) => s + (r.covers || 0), 0);

    // Build 30-day bucketed sparkline arrays (index 0 = 29 days ago ... 29 = today)
    const bucketIndex = new Map<string, number>();
    const revenueSpark = new Array<number>(30).fill(0);
    const receiptsSpark = new Array<number>(30).fill(0);
    const coversSpark = new Array<number>(30).fill(0);
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (29 - i));
      bucketIndex.set(d.toISOString().slice(0, 10), i);
    }
    for (const row of dailyRows) {
      const idx = bucketIndex.get(row.business_day);
      if (idx === undefined) continue;
      revenueSpark[idx]! += row.revenue_cents || 0;
      receiptsSpark[idx]! += row.receipts_count || 0;
      coversSpark[idx]! += row.covers || 0;
    }

    const foodCostRows = foodCostRes.data ?? [];
    const foodCostSpark = foodCostRows
      .map((r) => r.food_cost_pct)
      .filter((v): v is number => v !== null && !Number.isNaN(v));
    const foodCostPct =
      foodCostSpark.length > 0
        ? foodCostSpark[foodCostSpark.length - 1]!
        : null;

    fiscal = {
      enabled: true,
      revenueCents,
      foodCostPct,
      receipts,
      covers,
      restaurantId: fiscalEnabledIds[0] ?? primaryRestaurantId,
      revenueSpark,
      receiptsSpark,
      coversSpark,
      foodCostSpark,
    };
  } else {
    fiscal = {
      enabled: false,
      revenueCents: 0,
      foodCostPct: null,
      receipts: 0,
      covers: 0,
      restaurantId: primaryRestaurantId,
      revenueSpark: [],
      receiptsSpark: [],
      coversSpark: [],
      foodCostSpark: [],
    };
  }

  // Recent orders
  const recentOrders = (recentOrdersRes.data || []).map((o) => ({
    id: o.id,
    status: o.status,
    total: o.total,
    totalGross: grossFor(o.id, o.total, vatByOrder),
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
        spendingGross: currentSpendingGross,
        prevSpending,
        prevSpendingGross,
        savings: Math.round(currentSpending * 0.08),
        savingsGross: Math.round(currentSpendingGross * 0.08),
        activeSuppliers: uniqueSuppliers,
      }}
      fiscal={fiscal}
      spendPoints={spendPoints}
      spendPointsGross={spendPointsGross}
      transactionsByDate={transactionsByDate}
      recentOrders={recentOrders}
    />
  );
}
