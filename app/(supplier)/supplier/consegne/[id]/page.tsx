/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/supplier/permissions";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import type { DeliveryStatus, SupplierRole } from "@/types/database";
import type { DeliveryItemRow, DeliveryDetail } from "@/components/supplier/delivery/delivery-detail-mobile";
import { DeliveryDetailPageClient } from "./delivery-detail-client";
import { ArrowLeft, Truck } from "lucide-react";

export const metadata: Metadata = { title: "Dettaglio consegna" };

export const dynamic = "force-dynamic";

type Params = { id: string };

type DeliveryJoin = {
  id: string;
  status: DeliveryStatus;
  scheduled_date: string;
  scheduled_slot: Record<string, unknown> | null;
  delivered_at: string | null;
  failure_reason: string | null;
  notes: string | null;
  recipient_signature_url: string | null;
  pod_photo_url: string | null;
  driver_member_id: string | null;
  order_split_id: string;
  order_splits: {
    id: string;
    supplier_id: string;
    delivery_zone_id: string | null;
    orders: {
      id: string;
      restaurants: {
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        province: string | null;
        zip_code: string | null;
        phone: string | null;
      } | null;
    } | null;
  } | null;
};

type DeliveryItemJoin = {
  id: string;
  quantity_base: number;
  quantity_sales_unit: number;
  order_split_item_id: string;
  lot_id: string;
  order_split_items: {
    id: string;
    product_id: string;
    sales_unit_id: string | null;
  } | null;
  stock_lots: {
    id: string;
    lot_code: string | null;
    expiry_date: string | null;
  } | null;
};

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sage">Sessione non valida.</p>
      </Card>
    );
  }

  const { data: raw } = (await (supabase as any)
    .from("deliveries")
    .select(
      `id, status, scheduled_date, scheduled_slot, delivered_at,
       failure_reason, notes, recipient_signature_url, pod_photo_url,
       driver_member_id, order_split_id,
       order_splits:order_split_id (
         id, supplier_id, delivery_zone_id,
         orders:order_id (
           id,
           restaurants:restaurant_id ( id, name, address, city, province, zip_code, phone )
         )
       )`,
    )
    .eq("id", id)
    .maybeSingle()) as { data: DeliveryJoin | null };

  if (!raw) notFound();

  const supplierId = raw.order_splits?.supplier_id ?? null;
  if (!supplierId) notFound();

  // Permesso + membership
  const { data: member } = await supabase
    .from("supplier_members")
    .select("id, role")
    .eq("supplier_id", supplierId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle<{ id: string; role: SupplierRole }>();

  if (!member || !hasPermission(member.role, "delivery.execute")) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/consegne" className="inline-flex items-center gap-1 text-sm text-sage hover:text-forest">
          <ArrowLeft className="h-4 w-4" /> Torna alle consegne
        </Link>
        <Card className="py-16 text-center">
          <Truck className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
          <p className="text-sage">Non hai i permessi per aprire questa consegna.</p>
        </Card>
      </div>
    );
  }

  // Driver senza delivery.plan → vede solo le proprie.
  const canPlan = hasPermission(member.role, "delivery.plan");
  if (!canPlan && raw.driver_member_id && raw.driver_member_id !== member.id) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/consegne" className="inline-flex items-center gap-1 text-sm text-sage hover:text-forest">
          <ArrowLeft className="h-4 w-4" /> Torna alle consegne
        </Link>
        <Card className="py-16 text-center">
          <Truck className="mx-auto mb-4 h-12 w-12 text-sage-muted" />
          <p className="text-sage">Consegna assegnata a un altro autista.</p>
        </Card>
      </div>
    );
  }

  // Items
  const { data: rawItems } = (await (supabase as any)
    .from("delivery_items")
    .select(
      `id, quantity_base, quantity_sales_unit, order_split_item_id, lot_id,
       order_split_items:order_split_item_id ( id, product_id, sales_unit_id ),
       stock_lots:lot_id ( id, lot_code, expiry_date )`,
    )
    .eq("delivery_id", id)) as { data: DeliveryItemJoin[] | null };

  const productIds = Array.from(
    new Set(
      (rawItems ?? [])
        .map((r) => r.order_split_items?.product_id)
        .filter((p): p is string => !!p),
    ),
  );
  const salesUnitIds = Array.from(
    new Set(
      (rawItems ?? [])
        .map((r) => r.order_split_items?.sales_unit_id)
        .filter((p): p is string => !!p),
    ),
  );

  const productMap = new Map<string, { name: string; code: string | null; base_unit: string | null }>();
  if (productIds.length > 0) {
    const { data: prods } = (await supabase
      .from("products")
      .select("id, name, sku, unit")
      .in("id", productIds)) as {
      data: Array<{ id: string; name: string; sku: string | null; unit: string | null }> | null;
    };
    for (const p of prods ?? []) {
      productMap.set(p.id, {
        name: p.name,
        code: p.sku,
        base_unit: p.unit,
      });
    }
  }

  const salesUnitMap = new Map<string, { label: string; unit_type: string | null }>();
  if (salesUnitIds.length > 0) {
    const { data: psu } = (await (supabase as any)
      .from("product_sales_units")
      .select("id, label, unit_type")
      .in("id", salesUnitIds)) as {
      data: Array<{ id: string; label: string; unit_type: string | null }> | null;
    };
    for (const s of psu ?? []) {
      salesUnitMap.set(s.id, { label: s.label, unit_type: s.unit_type });
    }
  }

  const items: DeliveryItemRow[] = (rawItems ?? []).map((r) => {
    const prodId = r.order_split_items?.product_id ?? null;
    const suId = r.order_split_items?.sales_unit_id ?? null;
    const prod = prodId ? productMap.get(prodId) : null;
    const su = suId ? salesUnitMap.get(suId) : null;
    return {
      id: r.id,
      quantity_base: Number(r.quantity_base ?? 0),
      quantity_sales_unit: Number(r.quantity_sales_unit ?? 0),
      product_name: prod?.name ?? "Prodotto",
      product_code: prod?.code ?? null,
      sales_unit_label: su?.label ?? null,
      base_unit_label: prod?.base_unit ?? null,
      lot_code: r.stock_lots?.lot_code ?? null,
      expiry_date: r.stock_lots?.expiry_date ?? null,
    };
  });

  // Zone name
  let zoneName: string | null = null;
  if (raw.order_splits?.delivery_zone_id) {
    const { data: z } = await supabase
      .from("delivery_zones")
      .select("zone_name")
      .eq("id", raw.order_splits.delivery_zone_id)
      .maybeSingle<{ zone_name: string | null }>();
    zoneName = z?.zone_name ?? null;
  }

  const slot = raw.scheduled_slot ?? null;

  const detail: DeliveryDetail = {
    id: raw.id,
    status: raw.status,
    scheduled_date: raw.scheduled_date,
    scheduled_slot: slot
      ? {
          label: (slot.label as string | undefined) ?? null,
          start: (slot.start as string | undefined) ?? null,
          end: (slot.end as string | undefined) ?? null,
        }
      : null,
    delivered_at: raw.delivered_at,
    failure_reason: raw.failure_reason,
    notes: raw.notes,
    recipient_signature_url: raw.recipient_signature_url,
    pod_photo_url: raw.pod_photo_url,
    order_split_id: raw.order_split_id,
    driver_member_id: raw.driver_member_id,
    zone_name: zoneName,
    restaurant: raw.order_splits?.orders?.restaurants
      ? {
          name: raw.order_splits.orders.restaurants.name,
          address: raw.order_splits.orders.restaurants.address,
          city: raw.order_splits.orders.restaurants.city,
          province: raw.order_splits.orders.restaurants.province,
          zip_code: raw.order_splits.orders.restaurants.zip_code,
          phone: raw.order_splits.orders.restaurants.phone,
        }
      : null,
    items,
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <RealtimeRefresh
        subscriptions={[{ table: "deliveries", filter: `id=eq.${id}` }]}
      />
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/supplier/consegne"
          className="inline-flex h-11 items-center gap-1 text-sm text-sage hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" /> Consegne
        </Link>
        <Link href={`/supplier/ordini/${raw.order_splits?.id ?? ""}`}>
          <Button size="sm" variant="ghost">
            Vedi ordine
          </Button>
        </Link>
      </div>
      <DeliveryDetailPageClient delivery={detail} />
    </div>
  );
}
