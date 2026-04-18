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

export const metadata: Metadata = { title: "Ordini Fornitore" };

const PAGE_SIZE = 50;

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

  await markSectionSeen("supplier_orders");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("profile_id", user?.id ?? "")
    .single<{ id: string }>();

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

  let query = supabase
    .from("order_splits")
    .select(
      `id, order_id, subtotal, status, supplier_notes, expected_delivery_date, delivery_zone_id,
       orders:order_id ( id, created_at, restaurants:restaurant_id ( name ) )`,
    )
    .eq("supplier_id", supplierId ?? "none")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (filterState && stateToRawStatus[filterState]) {
    query = query.eq("status", stateToRawStatus[filterState]);
  }

  const { data: rawSplits } = await query.returns<SplitJoined[]>();

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
        orderNumber: null,
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
      if (filterFrom) {
        if (!r.createdAt || r.createdAt < filterFrom) return false;
      }
      if (filterTo) {
        // include end-of-day su filterTo
        const endOfDay = `${filterTo}T23:59:59`;
        if (!r.createdAt || r.createdAt > endOfDay) return false;
      }
      return true;
    })
    // Ordina per data ricezione desc.
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="space-y-6">
      {supplierId && (
        <RealtimeRefresh
          subscriptions={[
            { table: "order_splits", filter: `supplier_id=eq.${supplierId}` },
            { table: "order_split_items" },
            { table: "order_split_events" },
          ]}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-text-primary">
            Ordini<span className="text-brand-primary">.</span>
          </h1>
          <p className="text-sm text-text-secondary">
            Gestisci gli ordini dei tuoi clienti con filtri stato, ristorante e periodo.
          </p>
        </div>
        <Link
          href="/supplier/ordini/kanban"
          className="text-sm text-forest underline hover:text-forest-dark whitespace-nowrap"
        >
          Vista kanban
        </Link>
      </div>

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
    </div>
  );
}
