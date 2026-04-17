import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./orders-client";
import type { OrderFeedRow, OrderStats } from "./_lib/types";

export const metadata: Metadata = { title: "Ordini" };

type OrderRow = {
  id: string;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type SplitSupplierRow = {
  order_id: string;
  suppliers: { company_name: string } | null;
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .returns<Array<{ id: string }>>();

  const restaurantIds = (restaurants ?? []).map((r) => r.id);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, status, notes, created_at")
    .in("restaurant_id", restaurantIds.length > 0 ? restaurantIds : ["none"])
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  const orderList = orders ?? [];
  const orderIds = orderList.map((o) => o.id);

  // orders has no direct supplier_id. Supplier display name comes from the
  // first split's supplier; supplierCount surfaces multi-supplier orders.
  const splitsByOrder = new Map<string, { name: string | null; count: number }>();
  if (orderIds.length > 0) {
    const { data: splits } = await supabase
      .from("order_splits")
      .select("order_id, suppliers(company_name)")
      .in("order_id", orderIds)
      .returns<SplitSupplierRow[]>();

    for (const s of splits ?? []) {
      const existing = splitsByOrder.get(s.order_id);
      const name = s.suppliers?.company_name ?? null;
      if (!existing) {
        splitsByOrder.set(s.order_id, { name, count: 1 });
      } else {
        splitsByOrder.set(s.order_id, {
          name: existing.name ?? name,
          count: existing.count + 1,
        });
      }
    }
  }

  const rows: OrderFeedRow[] = orderList.map((o) => {
    const split = splitsByOrder.get(o.id);
    return {
      id: o.id,
      total: Number(o.total) || 0,
      status: o.status,
      notes: o.notes,
      createdAt: o.created_at,
      supplierName: split?.name ?? null,
      supplierCount: split?.count ?? 0,
    };
  });

  // Stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let monthTotal = 0;
  const statusCounts: Record<string, number> = {};
  for (const r of rows) {
    const d = new Date(r.createdAt);
    if (!Number.isNaN(d.getTime()) && d >= monthStart) {
      monthTotal += r.total;
    }
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  const stats: OrderStats = {
    totalCount: rows.length,
    monthTotal,
    statusCounts,
  };

  return <OrdersClient orders={rows} stats={stats} />;
}
