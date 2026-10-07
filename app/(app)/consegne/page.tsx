/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { loadOrderableOffers, loadSchedules } from "@/lib/restaurants/ordering/server";
import { nextDeadline, romeToday } from "@/lib/restaurants/ordering/schedule";
import { DeliveriesClient, type SupplierScheduleRow, type UpcomingDelivery } from "./deliveries-client";

export const metadata: Metadata = { title: "Consegne e orari limite" };

const CLOSED = new Set(["delivered", "completed", "cancelled", "rejected"]);

export default async function DeliveriesPage() {
  const ctx = await getRestaurantContext();
  if (!ctx) redirect("/dashboard");
  const nowMs = Date.now();
  const catalog = await loadOrderableOffers(ctx.scopeIds);
  const schedules = await loadSchedules(ctx, catalog.suppliers);

  const rows: SupplierScheduleRow[] = catalog.suppliers.map((s) => {
    const sch = schedules.get(s.key) ?? null;
    const next = sch ? nextDeadline(sch, nowMs) : null;
    return {
      key: s.key,
      kind: s.kind,
      name: s.name,
      catalogLeadDays: s.catalogLeadDays,
      schedule: sch,
      deadlineMs: next?.deadlineMs ?? null,
      deliveryDate: next?.deliveryDate ?? null,
    };
  });

  // Deliveries the suppliers announced (marketplace splits with a date).
  const supabase = (await createClient()) as any;
  const today = romeToday(nowMs);
  const { data: splits } = (await supabase
    .from("order_splits")
    .select("id, order_id, status, expected_delivery_date, suppliers(company_name), orders!inner(restaurant_id)")
    .in("orders.restaurant_id", ctx.scopeIds)
    .gte("expected_delivery_date", today)
    .order("expected_delivery_date", { ascending: true })
    .limit(60)) as {
    data:
      | {
          id: string;
          order_id: string;
          status: string;
          expected_delivery_date: string | null;
          suppliers: { company_name: string } | null;
        }[]
      | null;
  };
  const upcoming: UpcomingDelivery[] = (splits ?? [])
    .filter((s) => s.expected_delivery_date && !CLOSED.has(s.status))
    .map((s) => ({
      splitId: s.id,
      orderId: s.order_id,
      supplierName: s.suppliers?.company_name ?? "Fornitore",
      date: s.expected_delivery_date!,
      status: s.status,
    }));

  return (
    <DeliveriesClient
      rows={rows}
      upcoming={upcoming}
      canEdit={contextCan(ctx, "order.submit")}
      today={today}
    />
  );
}
