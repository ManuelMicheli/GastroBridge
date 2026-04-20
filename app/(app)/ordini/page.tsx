import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./orders-client";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { deriveOrderStatus } from "@/lib/orders/derive-order-status";
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
  status: string;
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
  // We also collect per-split statuses here so we can derive the restaurant-
  // facing order status from them (supplier workflow only mutates splits,
  // never orders.status).
  const splitsByOrder = new Map<
    string,
    { name: string | null; count: number; statuses: string[] }
  >();
  if (orderIds.length > 0) {
    const { data: splits } = await supabase
      .from("order_splits")
      .select("order_id, status, suppliers(company_name)")
      .in("order_id", orderIds)
      .returns<SplitSupplierRow[]>();

    for (const s of splits ?? []) {
      const existing = splitsByOrder.get(s.order_id);
      const name = s.suppliers?.company_name ?? null;
      if (!existing) {
        splitsByOrder.set(s.order_id, { name, count: 1, statuses: [s.status] });
      } else {
        splitsByOrder.set(s.order_id, {
          name: existing.name ?? name,
          count: existing.count + 1,
          statuses: [...existing.statuses, s.status],
        });
      }
    }
  }

  const rows: OrderFeedRow[] = orderList.map((o) => {
    const split = splitsByOrder.get(o.id);
    const derivedStatus = deriveOrderStatus(split?.statuses ?? [], o.status);
    return {
      id: o.id,
      total: Number(o.total) || 0,
      status: derivedStatus,
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

  return (
    <>
      <RealtimeRefresh
        subscriptions={[
          { table: "order_splits" },
          { table: "orders" },
        ]}
      />
      <OrdersClient orders={rows} stats={stats} />
    </>
  );
}
