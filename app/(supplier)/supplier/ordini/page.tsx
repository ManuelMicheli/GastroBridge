import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import { markSectionSeen } from "@/lib/nav/section-seen";
import {
  SupplierOrdersClient,
  type SupplierOrderRow,
} from "./orders-client";
import { getCurrentSupplierMember } from "@/lib/supplier/current-member";

export const metadata: Metadata = { title: "Ordini Fornitore" };

const PAGE_SIZE = 50;
const MAX_LIMIT = 500;

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

type SplitJoined = {
  id: string;
  order_id: string;
  subtotal: number;
  status: string;
  supplier_notes: string | null;
  expected_delivery_date: string | null;
  delivery_zone_id: string | null;
  orders: {
    id: string;
    created_at: string;
    restaurants: { name: string } | null;
  } | null;
};

function loadMoreQuery(sp: SearchParams, nextLimit: number): string {
  const qs = new URLSearchParams();
  for (const key of ["state", "restaurant", "from", "to"]) {
    const v = firstParam(sp[key]);
    if (v) qs.set(key, v);
  }
  qs.set("limit", String(nextLimit));
  return qs.toString();
}

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filterState = firstParam(sp.state);
  const filterRestaurant = firstParam(sp.restaurant).trim();
  const filterFrom = firstParam(sp.from);
  const filterTo = firstParam(sp.to);
  // "Carica altri": the page grows by PAGE_SIZE through ?limit=.
  const limitParam = Number.parseInt(firstParam(sp.limit), 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, PAGE_SIZE), MAX_LIMIT)
    : PAGE_SIZE;

  await markSectionSeen("supplier_orders");

  const supabase = await createClient();
  const member = await getCurrentSupplierMember();
  const supplier = member ? { id: member.supplier_id } : null;

  const supplierId = supplier?.id;

  // Map workflow-state filter to raw enum status (cfr. WORKFLOW_STATE_MAP in supplier-actions).
  const stateToRawStatus: Record<string, string> = {
    submitted: "submitted",
    pending_customer_confirmation: "submitted",
    stock_conflict: "submitted",
    confirmed: "confirmed",
    preparing: "preparing",
    packed: "preparing",
    shipping: "shipping",
    delivered: "delivered",
    rejected: "cancelled",
    cancelled: "cancelled",
  };

  // order_splits has no created_at: order (and date-filter) by the parent
  // order's created_at at the DB level, newest first. Ordering by the uuid
  // and re-sorting in memory used to show an arbitrary 50.
  let query = supabase
    .from("order_splits")
    .select(
      `id, order_id, subtotal, status, supplier_notes, expected_delivery_date, delivery_zone_id,
       orders:order_id!inner ( id, created_at, restaurants:restaurant_id ( name ) )`,
    )
    .eq("supplier_id", supplierId ?? "none")
    .order("orders(created_at)", { ascending: false })
    .limit(limit);

  if (filterState && stateToRawStatus[filterState]) {
    query = query.eq("status", stateToRawStatus[filterState]);
  }
  if (filterFrom) {
    query = query.gte("orders.created_at", filterFrom);
  }
  if (filterTo) {
    // include end-of-day su filterTo
    query = query.lte("orders.created_at", `${filterTo}T23:59:59`);
  }

  const { data: rawSplits } = await query.returns<SplitJoined[]>();
  const hasMore = (rawSplits?.length ?? 0) === limit && limit < MAX_LIMIT;

  // Carica nomi zona in un colpo solo.
  const zoneIds = Array.from(
    new Set(
      (rawSplits ?? [])
        .map((s) => s.delivery_zone_id)
        .filter((z): z is string => !!z),
    ),
  );
  const zoneMap = new Map<string, string>();
  if (zoneIds.length > 0) {
    const { data: zones } = await supabase
      .from("delivery_zones")
      .select("id, zone_name")
      .in("id", zoneIds)
      .returns<Array<{ id: string; zone_name: string | null }>>();
    for (const z of zones ?? []) {
      if (z.zone_name) zoneMap.set(z.id, z.zone_name);
    }
  }

  const rows: SupplierOrderRow[] = (rawSplits ?? [])
    .map((s) => {
      const wf = getWorkflowState(s.status, s.supplier_notes) as string;
      return {
        splitId: s.id,
        orderId: s.order_id,
        // Same short code the restaurant sees for its order.
        orderNumber: `#${s.order_id.slice(0, 8).toUpperCase()}`,
        restaurantName: s.orders?.restaurants?.name ?? "Ristorante",
        zoneName: s.delivery_zone_id ? zoneMap.get(s.delivery_zone_id) ?? null : null,
        createdAt: s.orders?.created_at ?? "",
        expectedDeliveryDate: s.expected_delivery_date,
        subtotal: Number(s.subtotal || 0),
        workflowState: wf,
        rawStatus: s.status,
      };
    })
    // Filtro post-fetch per stati workflow encoded in notes (es. packed → raw preparing).
    .filter((r) => {
      if (filterState && r.workflowState !== filterState) return false;
      if (
        filterRestaurant &&
        !r.restaurantName.toLowerCase().includes(filterRestaurant.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

  return (
    <>
      {supplierId && (
        <RealtimeRefresh
          subscriptions={[
            { table: "order_splits", filter: `supplier_id=eq.${supplierId}` },
            { table: "order_split_items" },
            { table: "order_split_events" },
          ]}
        />
      )}

      <SupplierOrdersClient
        orders={rows}
        filters={{
          state: filterState,
          restaurant: filterRestaurant,
          from: filterFrom,
          to: filterTo,
        }}
        total={rows.length}
      />

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Link
            href={`/supplier/ordini?${loadMoreQuery(sp, limit + PAGE_SIZE)}`}
            scroll={false}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary hover:text-text-primary"
          >
            Carica altri ordini
          </Link>
        </div>
      )}
    </>
  );
}
