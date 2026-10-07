import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import { resolveRelationshipIdForPair } from "@/lib/messages/context";
import { getUnreadCount } from "@/lib/messages/queries";
import { OrderDetailClient } from "./order-detail-client";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import Link from "next/link";

export const metadata: Metadata = { title: "Dettaglio Ordine Fornitore" };

type SplitRow = {
  id: string;
  order_id: string;
  supplier_id: string;
  subtotal: number;
  status: string;
  supplier_notes: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  expected_delivery_date: string | null;
  orders: {
    id: string;
    created_at: string;
    restaurants: { id: string; name: string } | null;
  } | null;
};

type LineRow = {
  id: string;
  order_split_id: string;
  product_id: string;
  sales_unit_id: string | null;
  quantity_requested: number;
  quantity_accepted: number | null;
  unit_price: number;
  status: string;
  rejection_reason: string | null;
  notes: string | null;
  products: { name: string } | null;
  product_sales_units: { label: string; unit_type: string } | null;
};

type EventRow = {
  id: string;
  event_type: string;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  member_id: string | null;
};

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: splitId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const member = await getCurrentSupplierMember();
  const supplier = member ? { id: member.supplier_id } : null;

  if (!supplier) notFound();

  const { data: split } = await supabase
    .from("order_splits")
    .select(
      "id, order_id, supplier_id, subtotal, status, supplier_notes, confirmed_at, shipped_at, delivered_at, expected_delivery_date, orders:order_id(id, created_at, restaurants:restaurant_id(id, name))",
    )
    .eq("id", splitId)
    .eq("supplier_id", supplier.id)
    .maybeSingle<SplitRow>();

  if (!split) notFound();

  const { data: lines } = await supabase
    .from("order_split_items")
    .select(
      "id, order_split_id, product_id, sales_unit_id, quantity_requested, quantity_accepted, unit_price, status, rejection_reason, notes, products:product_id(name), product_sales_units:sales_unit_id(label, unit_type)",
    )
    .eq("order_split_id", splitId)
    .order("id", { ascending: true })
    .returns<LineRow[]>();

  const { data: events } = await supabase
    .from("order_split_events")
    .select("id, event_type, note, metadata, created_at, member_id")
    .eq("order_split_id", splitId)
    .order("created_at", { ascending: false })
    .returns<EventRow[]>();

  const workflowState = getWorkflowState(split.status, split.supplier_notes);
  const restaurantName = split.orders?.restaurants?.name ?? "Ristorante";
  const orderCreatedAt = split.orders?.created_at ?? null;

  // Resolve the partnership relationship and unread-count for the per-order chat drawer.
  const restaurantId = split.orders?.restaurants?.id ?? null;
  const relationshipId = restaurantId
    ? await resolveRelationshipIdForPair(restaurantId, split.supplier_id)
    : null;
  const unreadChat = relationshipId
    ? await getUnreadCount(relationshipId, split.id)
    : 0;

  // Delivery / DDT for this split (created by the packing step), so the
  // order links to the logistics pages it otherwise had no path to.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliveries/ddt_documents not in generated types
  const { data: deliveryRows } = (await (supabase as any)
    .from("deliveries")
    .select("id, status, ddt_documents ( id, number, year, canceled_at )")
    .eq("order_split_id", splitId)) as {
    data:
      | {
          id: string;
          status: string;
          ddt_documents: { id: string; number: number; year: number; canceled_at: string | null }[] | null;
        }[]
      | null;
  };
  const canOpenDelivery = memberCan(member, "delivery.execute");
  const canOpenDdt = memberCan(member, "ddt.generate");
  const logisticsLinks: { href: string; label: string }[] = [];
  for (const d of deliveryRows ?? []) {
    if (canOpenDelivery) {
      logisticsLinks.push({ href: `/supplier/consegne/${d.id}`, label: "Consegna" });
    }
    if (canOpenDdt) {
      for (const ddt of d.ddt_documents ?? []) {
        if (ddt.canceled_at) continue;
        logisticsLinks.push({ href: `/supplier/ddt/${ddt.id}`, label: `DDT ${ddt.number}/${ddt.year}` });
      }
    }
  }

  return (
    <>
    {logisticsLinks.length > 0 && (
      <nav aria-label="Logistica ordine" className="mb-3 flex flex-wrap gap-3 text-sm">
        {logisticsLinks.map((l) => (
          <Link key={l.href} href={l.href} className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
            {l.label} →
          </Link>
        ))}
      </nav>
    )}
    <OrderDetailClient
      splitId={split.id}
      restaurantName={restaurantName}
      orderCreatedAt={orderCreatedAt}
      expectedDeliveryDate={split.expected_delivery_date}
      subtotal={split.subtotal}
      workflowState={workflowState}
      rawStatus={split.status}
      relationshipId={relationshipId}
      currentUserId={user.id}
      unreadChat={unreadChat}
      lines={(lines ?? []).map((l) => ({
        id: l.id,
        productName: l.products?.name ?? "Prodotto",
        salesUnitLabel: l.product_sales_units?.label ?? null,
        salesUnitType: l.product_sales_units?.unit_type ?? null,
        quantityRequested: Number(l.quantity_requested),
        quantityAccepted:
          l.quantity_accepted === null ? null : Number(l.quantity_accepted),
        unitPrice: Number(l.unit_price),
        status: l.status,
        rejectionReason: l.rejection_reason,
        notes: l.notes,
      }))}
      events={(events ?? []).map((e) => ({
        id: e.id,
        eventType: e.event_type,
        note: e.note,
        metadata: e.metadata,
        createdAt: e.created_at,
      }))}
    />
    </>
  );
}
