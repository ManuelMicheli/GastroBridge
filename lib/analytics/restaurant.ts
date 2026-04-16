import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseSupplierHeaders, parseLineItems, normalizeProductKey } from "./notes-parser";
import { inferCategory, MACRO_CATEGORY_LABELS, type MacroCategory } from "./category-keywords";
import { computePeriodRange, type PeriodKey, type PeriodRange } from "./period";

// -------------------------- Public types ---------------------------------

export type VarianceRow = {
  name: string;
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
};

export type CategoryBreakdownRow = {
  category: MacroCategory;
  label: string;
  amount: number;
  percent: number;
};

export type ProductInsightRow = {
  name: string;
  category: MacroCategory;
  totalSpend: number;
  quantity: number;
  avgUnitPrice: number;
  prevAvgUnitPrice: number | null;
  priceDeltaPct: number | null;
  orderCount: number;
};

export type SupplierBreakdownRow = {
  name: string;
  spending: number;
  orderCount: number;
};

export type WeekdayCell = {
  weekday: number; // 0=Mon…6=Sun
  totalSpend: number;
  orderCount: number;
};

export type YoyPoint = {
  month: string; // ISO "YYYY-MM"
  label: string; // "Apr"
  current: number;
  previous: number | null;
};

export type RecentOrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  supplier_count: number;
  item_count: number;
};

export type BudgetState = {
  amount: number | null;
  spent: number;
  projected: number;
  percentUsed: number | null;
  daysElapsed: number;
  daysInMonth: number;
};

export type RestaurantAnalytics = {
  period: { key: PeriodKey; label: string; from: string; to: string };
  currentSpending: number;
  previousSpending: number;
  currentOrderCount: number;
  previousOrderCount: number;
  avgTicket: number;
  spendingSparkline: number[];
  budget: BudgetState;
  variance: {
    delta: number;
    deltaPct: number | null;
    topByCategory: VarianceRow[];
    topBySupplier: VarianceRow[];
    topByProduct: VarianceRow[];
  };
  categoryBreakdown: CategoryBreakdownRow[];
  supplierBreakdown: SupplierBreakdownRow[];
  productInsights: ProductInsightRow[];
  yearOverYear: YoyPoint[];
  weekdayPattern: WeekdayCell[];
  recentOrders: RecentOrderRow[];
};

// -------------------------- Internal types -------------------------------

type OrderRow = {
  id: string;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type OrderItemAgg = {
  supplier: string;
  quantity: number;
  productName: string;
  unitPrice: number;
  lineSubtotal: number;
  category: MacroCategory;
};

// -------------------------- Defaults -------------------------------------

function emptyBudget(): BudgetState {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    amount: null,
    spent: 0,
    projected: 0,
    percentUsed: null,
    daysElapsed: now.getDate(),
    daysInMonth,
  };
}

function emptyAnalytics(periodRange: PeriodRange): RestaurantAnalytics {
  return {
    period: {
      key: periodRange.key,
      label: periodRange.label,
      from: periodRange.from.toISOString(),
      to: periodRange.to.toISOString(),
    },
    currentSpending: 0,
    previousSpending: 0,
    currentOrderCount: 0,
    previousOrderCount: 0,
    avgTicket: 0,
    spendingSparkline: [],
    budget: emptyBudget(),
    variance: { delta: 0, deltaPct: null, topByCategory: [], topBySupplier: [], topByProduct: [] },
    categoryBreakdown: [],
    supplierBreakdown: [],
    productInsights: [],
    yearOverYear: [],
    weekdayPattern: [],
    recentOrders: [],
  };
}

// -------------------------- Helpers --------------------------------------

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

function orderItemsFromOrder(order: OrderRow): OrderItemAgg[] {
  // Catalog orders: parse notes.
  const items = parseLineItems(order.notes);
  return items.map((it) => ({
    supplier: it.supplier,
    quantity: it.quantity,
    productName: it.productName,
    unitPrice: it.unitPrice,
    lineSubtotal: it.lineSubtotal,
    category: inferCategory(it.productName),
  }));
}

function suppliersFromOrder(order: OrderRow): { name: string; subtotal: number }[] {
  return parseSupplierHeaders(order.notes);
}

function getIsoMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

function countOrderItems(order: OrderRow): number {
  return parseLineItems(order.notes).length;
}

// -------------------------- Main -----------------------------------------

export async function getRestaurantAnalytics(
  periodKey: PeriodKey = "current",
): Promise<RestaurantAnalytics> {
  const supabase = await createClient();
  const periodRange = computePeriodRange(periodKey);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyAnalytics(periodRange);

  const { data: restaurants } = (await supabase
    .from("restaurants")
    .select("id, monthly_budget_eur")
    .eq("profile_id", user.id)) as {
    data: { id: string; monthly_budget_eur: number | null }[] | null;
  };

  const restaurantIds = restaurants?.map((r) => r.id) ?? [];
  if (restaurantIds.length === 0) return emptyAnalytics(periodRange);
  const monthlyBudget = restaurants?.[0]?.monthly_budget_eur ?? null;

  // Fetch up to 24 months for YoY + variance + full history
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);

  const { data: allOrdersRaw } = (await supabase
    .from("orders")
    .select("id, total, status, notes, created_at")
    .in("restaurant_id", restaurantIds)
    .gte("created_at", twoYearsAgo.toISOString())
    .order("created_at", { ascending: false })) as { data: OrderRow[] | null };

  const allOrders = (allOrdersRaw ?? []).map((o) => ({
    ...o,
    total: Number(o.total) || 0,
  }));

  // Partition by period
  const currentOrders = allOrders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t >= periodRange.from.getTime() && t < periodRange.to.getTime();
  });
  const previousOrders = allOrders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t >= periodRange.previous.from.getTime() && t < periodRange.previous.to.getTime();
  });

  const currentSpending = currentOrders.reduce((s, o) => s + o.total, 0);
  const previousSpending = previousOrders.reduce((s, o) => s + o.total, 0);
  const currentOrderCount = currentOrders.length;
  const previousOrderCount = previousOrders.length;
  const avgTicket = currentOrderCount > 0 ? currentSpending / currentOrderCount : 0;

  // ----- Sparkline (14 days of current period, aligned to "to") -----
  const sparkMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(periodRange.to);
    d.setDate(d.getDate() - 1 - i);
    sparkMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of currentOrders) {
    const key = o.created_at.slice(0, 10);
    if (sparkMap.has(key)) sparkMap.set(key, (sparkMap.get(key) ?? 0) + o.total);
  }
  const spendingSparkline = Array.from(sparkMap.values());

  // ----- Budget state (always based on current calendar month regardless of periodKey) -----
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonthOrders = allOrders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return t >= thisMonthStart.getTime() && t < thisMonthEnd.getTime();
  });
  const thisMonthSpent = thisMonthOrders.reduce((s, o) => s + o.total, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const projected =
    daysElapsed > 0 ? (thisMonthSpent * daysInMonth) / daysElapsed : thisMonthSpent;
  const budget: BudgetState = {
    amount: monthlyBudget,
    spent: thisMonthSpent,
    projected,
    percentUsed: monthlyBudget && monthlyBudget > 0 ? (thisMonthSpent / monthlyBudget) * 100 : null,
    daysElapsed,
    daysInMonth,
  };

  // ----- Variance analysis -----
  const categoryCurr = new Map<MacroCategory, number>();
  const categoryPrev = new Map<MacroCategory, number>();
  const supplierCurr = new Map<string, { spend: number; orders: number }>();
  const supplierPrev = new Map<string, number>();
  const productCurr = new Map<string, { name: string; category: MacroCategory; spend: number; qty: number; prices: number[]; orders: Set<string> }>();
  const productPrev = new Map<string, { spend: number; prices: number[] }>();

  for (const o of currentOrders) {
    for (const it of orderItemsFromOrder(o)) {
      categoryCurr.set(it.category, (categoryCurr.get(it.category) ?? 0) + it.lineSubtotal);
      const key = normalizeProductKey(it.productName);
      const existing = productCurr.get(key);
      if (existing) {
        existing.spend += it.lineSubtotal;
        existing.qty += it.quantity;
        existing.prices.push(it.unitPrice);
        existing.orders.add(o.id);
      } else {
        productCurr.set(key, {
          name: it.productName.replace(/\([^)]*\)/g, "").trim() || it.productName,
          category: it.category,
          spend: it.lineSubtotal,
          qty: it.quantity,
          prices: [it.unitPrice],
          orders: new Set([o.id]),
        });
      }
    }
    for (const s of suppliersFromOrder(o)) {
      const existing = supplierCurr.get(s.name) ?? { spend: 0, orders: 0 };
      existing.spend += s.subtotal;
      existing.orders += 1;
      supplierCurr.set(s.name, existing);
    }
  }

  for (const o of previousOrders) {
    for (const it of orderItemsFromOrder(o)) {
      categoryPrev.set(it.category, (categoryPrev.get(it.category) ?? 0) + it.lineSubtotal);
      const key = normalizeProductKey(it.productName);
      const existing = productPrev.get(key);
      if (existing) {
        existing.spend += it.lineSubtotal;
        existing.prices.push(it.unitPrice);
      } else {
        productPrev.set(key, { spend: it.lineSubtotal, prices: [it.unitPrice] });
      }
    }
    for (const s of suppliersFromOrder(o)) {
      supplierPrev.set(s.name, (supplierPrev.get(s.name) ?? 0) + s.subtotal);
    }
  }

  // Build variance lists
  const categoryKeys = new Set<MacroCategory>([
    ...categoryCurr.keys(),
    ...categoryPrev.keys(),
  ]);
  const topByCategory: VarianceRow[] = Array.from(categoryKeys)
    .map((k) => {
      const c = categoryCurr.get(k) ?? 0;
      const p = categoryPrev.get(k) ?? 0;
      return {
        name: MACRO_CATEGORY_LABELS[k],
        current: c,
        previous: p,
        delta: c - p,
        deltaPct: pctDelta(c, p),
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  const supplierKeys = new Set<string>([...supplierCurr.keys(), ...supplierPrev.keys()]);
  const topBySupplier: VarianceRow[] = Array.from(supplierKeys)
    .map((name) => {
      const c = supplierCurr.get(name)?.spend ?? 0;
      const p = supplierPrev.get(name) ?? 0;
      return { name, current: c, previous: p, delta: c - p, deltaPct: pctDelta(c, p) };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  const productKeys = new Set<string>([...productCurr.keys(), ...productPrev.keys()]);
  const topByProduct: VarianceRow[] = Array.from(productKeys)
    .map((k) => {
      const c = productCurr.get(k)?.spend ?? 0;
      const p = productPrev.get(k)?.spend ?? 0;
      const name = productCurr.get(k)?.name ?? k;
      return { name, current: c, previous: p, delta: c - p, deltaPct: pctDelta(c, p) };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  // ----- Category breakdown -----
  const totalCategorized = Array.from(categoryCurr.values()).reduce((s, v) => s + v, 0) || 1;
  const categoryBreakdown: CategoryBreakdownRow[] = Array.from(categoryCurr.entries())
    .map(([category, amount]) => ({
      category,
      label: MACRO_CATEGORY_LABELS[category],
      amount,
      percent: (amount / totalCategorized) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  // ----- Supplier breakdown -----
  const supplierBreakdown: SupplierBreakdownRow[] = Array.from(supplierCurr.entries())
    .map(([name, v]) => ({ name, spending: v.spend, orderCount: v.orders }))
    .sort((a, b) => b.spending - a.spending);

  // ----- Product insights -----
  const productInsights: ProductInsightRow[] = Array.from(productCurr.entries())
    .map(([key, v]) => {
      const avg = v.prices.reduce((s, p) => s + p, 0) / v.prices.length;
      const prev = productPrev.get(key);
      const prevAvg = prev ? prev.prices.reduce((s, p) => s + p, 0) / prev.prices.length : null;
      const priceDeltaPct = prevAvg !== null && prevAvg > 0 ? ((avg - prevAvg) / prevAvg) * 100 : null;
      return {
        name: v.name,
        category: v.category,
        totalSpend: v.spend,
        quantity: v.qty,
        avgUnitPrice: avg,
        prevAvgUnitPrice: prevAvg,
        priceDeltaPct,
        orderCount: v.orders.size,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 15);

  // ----- YoY trend (last 12 months + same 12 of prev year) -----
  const yoyCurr = new Map<string, number>();
  const yoyPrev = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    yoyCurr.set(getIsoMonth(d), 0);
    const dPrev = new Date(d.getFullYear() - 1, d.getMonth(), 1);
    yoyPrev.set(getIsoMonth(dPrev), 0);
  }
  for (const o of allOrders) {
    const d = new Date(o.created_at);
    const key = getIsoMonth(d);
    if (yoyCurr.has(key)) yoyCurr.set(key, (yoyCurr.get(key) ?? 0) + o.total);
    if (yoyPrev.has(key)) yoyPrev.set(key, (yoyPrev.get(key) ?? 0) + o.total);
  }
  const yearOverYear: YoyPoint[] = Array.from(yoyCurr.entries()).map(([key, current]) => {
    const parts = key.split("-");
    const monthIdx = parseInt(parts[1] ?? "1", 10) - 1;
    const yearNum = parseInt(parts[0] ?? `${now.getFullYear()}`, 10);
    const prevKey = `${yearNum - 1}-${String(monthIdx + 1).padStart(2, "0")}`;
    const prev = yoyPrev.get(prevKey);
    return {
      month: key,
      label: MONTH_LABELS[monthIdx] ?? key,
      current,
      previous: prev !== undefined && prev > 0 ? prev : null,
    };
  });

  // ----- Weekday pattern (across period) -----
  const weekdayMap = new Map<number, { spend: number; orders: number }>();
  for (let i = 0; i < 7; i++) weekdayMap.set(i, { spend: 0, orders: 0 });
  for (const o of currentOrders) {
    // JS Date.getDay(): 0=Sun...6=Sat. We want 0=Mon...6=Sun.
    const jsDay = new Date(o.created_at).getDay();
    const mondayFirst = (jsDay + 6) % 7;
    const cell = weekdayMap.get(mondayFirst) ?? { spend: 0, orders: 0 };
    cell.spend += o.total;
    cell.orders += 1;
    weekdayMap.set(mondayFirst, cell);
  }
  const weekdayPattern: WeekdayCell[] = Array.from(weekdayMap.entries()).map(
    ([weekday, v]) => ({ weekday, totalSpend: v.spend, orderCount: v.orders }),
  );

  // ----- Recent orders (last 8 from current period, falling back to all) -----
  const source = currentOrders.length > 0 ? currentOrders : allOrders.slice(0, 8);
  const recentOrders: RecentOrderRow[] = source.slice(0, 8).map((o) => {
    const suppliers = suppliersFromOrder(o);
    return {
      id: o.id,
      total: o.total,
      status: o.status,
      created_at: o.created_at,
      supplier_count: suppliers.length,
      item_count: countOrderItems(o),
    };
  });

  const delta = currentSpending - previousSpending;

  return {
    period: {
      key: periodRange.key,
      label: periodRange.label,
      from: periodRange.from.toISOString(),
      to: periodRange.to.toISOString(),
    },
    currentSpending,
    previousSpending,
    currentOrderCount,
    previousOrderCount,
    avgTicket,
    spendingSparkline,
    budget,
    variance: {
      delta,
      deltaPct: pctDelta(currentSpending, previousSpending),
      topByCategory,
      topBySupplier,
      topByProduct,
    },
    categoryBreakdown,
    supplierBreakdown,
    productInsights,
    yearOverYear,
    weekdayPattern,
    recentOrders,
  };
}
