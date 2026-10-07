/* eslint-disable @typescript-eslint/no-explicit-any */
// Data for the "Giro consegne" (server-only).

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import type { DeliveryStatus } from "@/types/database";
import { planRoute, routeKm, type Point, type RouteStop } from "./plan";

export type GiroStop = RouteStop & {
  deliveryId: string;
  splitId: string;
  status: DeliveryStatus;
  driverMemberId: string | null;
  subtotal: number;
  phone: string | null;
  province: string | null;
  slotLabel: string | null;
  slotEnd: string | null;
  notes: string | null;
  failureReason: string | null;
  routePosition: number | null;
};

export type GiroData = {
  date: string;
  stops: GiroStop[];
  /** Saved order exists (route_position set on every stop). */
  savedOrder: boolean;
  /** route_position column available (migration applied). */
  canSaveOrder: boolean;
  origin: (Point & { label: string }) | null;
  originQuery: string | null;
  /** Delivery ids in the suggested (nearest-neighbour) order. */
  suggestedIds: string[];
  suggestedKm: number;
  currentKm: number;
  stillPreparing: number;
};

type Raw = {
  id: string;
  status: DeliveryStatus;
  driver_member_id: string | null;
  warehouse_id: string;
  scheduled_slot: Record<string, unknown> | null;
  notes: string | null;
  failure_reason: string | null;
  order_splits: {
    id: string;
    supplier_id: string;
    subtotal: number;
    delivery_zone_id: string | null;
    orders: {
      restaurants: {
        id: string;
        name: string;
        address: string | null;
        city: string | null;
        province: string | null;
        zip_code: string | null;
        phone: string | null;
        latitude: number | null;
        longitude: number | null;
      } | null;
    } | null;
  } | null;
};

export async function loadGiro(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  date: string,
  driverMemberId: string | null,
): Promise<GiroData> {
  let q = (supabase as any)
    .from("deliveries")
    .select(
      `id, status, driver_member_id, warehouse_id, scheduled_slot, notes, failure_reason,
       order_splits:order_split_id (
         id, supplier_id, subtotal, delivery_zone_id,
         orders:order_id ( restaurants:restaurant_id ( id, name, address, city, province, zip_code, phone, latitude, longitude ) )
       )`,
    )
    .eq("scheduled_date", date);
  if (driverMemberId) q = q.eq("driver_member_id", driverMemberId);
  const { data } = (await q) as { data: Raw[] | null };
  const rows = (data ?? []).filter((r) => r.order_splits?.supplier_id === supplierId);

  // Saved order (column added by 20261009000000 — absent until applied).
  const positions = new Map<string, number | null>();
  let canSaveOrder = false;
  if (rows.length > 0) {
    const { data: pos, error } = await (supabase as any)
      .from("deliveries")
      .select("id, route_position")
      .in("id", rows.map((r) => r.id));
    if (!error) {
      canSaveOrder = true;
      for (const p of (pos ?? []) as Array<{ id: string; route_position: number | null }>) {
        positions.set(p.id, p.route_position);
      }
    }
  } else {
    const { error } = await (supabase as any).from("deliveries").select("route_position").limit(1);
    canSaveOrder = !error;
  }

  const zoneIds = [...new Set(rows.map((r) => r.order_splits?.delivery_zone_id).filter((z): z is string => !!z))];
  const zoneNames = new Map<string, string>();
  if (zoneIds.length > 0) {
    const { data: zones } = (await (supabase as any)
      .from("delivery_zones")
      .select("id, zone_name")
      .in("id", zoneIds)) as { data: Array<{ id: string; zone_name: string | null }> | null };
    for (const z of zones ?? []) if (z.zone_name) zoneNames.set(z.id, z.zone_name);
  }

  // Departure warehouse: the one most stops leave from, else the primary.
  const { data: whs } = (await (supabase as any)
    .from("warehouses")
    .select("id, name, address, city, zip_code, latitude, longitude, is_primary")
    .eq("supplier_id", supplierId)) as {
    data: Array<{
      id: string;
      name: string;
      address: string | null;
      city: string | null;
      zip_code: string | null;
      latitude: number | null;
      longitude: number | null;
      is_primary: boolean;
    }> | null;
  };
  const whCount = new Map<string, number>();
  for (const r of rows) whCount.set(r.warehouse_id, (whCount.get(r.warehouse_id) ?? 0) + 1);
  const mainWhId = [...whCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const wh = (whs ?? []).find((w) => w.id === mainWhId) ?? (whs ?? []).find((w) => w.is_primary) ?? (whs ?? [])[0];
  const origin =
    wh && typeof wh.latitude === "number" && typeof wh.longitude === "number"
      ? { lat: wh.latitude, lng: wh.longitude, label: wh.name }
      : null;
  const originQuery = wh
    ? origin
      ? `${origin.lat},${origin.lng}`
      : [wh.address, wh.zip_code, wh.city].filter(Boolean).join(", ") || null
    : null;

  const stops: GiroStop[] = rows.map((r) => {
    const rest = r.order_splits?.orders?.restaurants ?? null;
    const slot = r.scheduled_slot ?? null;
    const zoneId = r.order_splits?.delivery_zone_id ?? null;
    return {
      id: r.id,
      deliveryId: r.id,
      splitId: r.order_splits?.id ?? "",
      status: r.status,
      driverMemberId: r.driver_member_id,
      subtotal: Number(r.order_splits?.subtotal ?? 0),
      name: rest?.name ?? "Cliente",
      address: rest?.address ?? null,
      city: rest?.city ?? null,
      province: rest?.province ?? null,
      zip: rest?.zip_code ?? null,
      phone: rest?.phone ?? null,
      lat: rest?.latitude ?? null,
      lng: rest?.longitude ?? null,
      zone: zoneId ? zoneNames.get(zoneId) ?? null : null,
      slotStart: ((slot?.start ?? slot?.from) as string | undefined) ?? null,
      slotEnd: ((slot?.end ?? slot?.to) as string | undefined) ?? null,
      slotLabel: (slot?.label as string | undefined) ?? null,
      notes: r.notes,
      failureReason: r.failure_reason,
      routePosition: positions.get(r.id) ?? null,
    };
  });

  const suggested = planRoute(stops, origin);
  const savedOrder = stops.length > 0 && stops.every((s) => s.routePosition !== null);
  const ordered: GiroStop[] = savedOrder
    ? [...stops].sort((a, b) => (a.routePosition ?? 0) - (b.routePosition ?? 0))
    : (suggested as GiroStop[]);

  // Orders due that day that have not been packed yet (no delivery row).
  const { data: due } = (await (supabase as any)
    .from("order_splits")
    .select("id, status, supplier_notes")
    .eq("supplier_id", supplierId)
    .eq("expected_delivery_date", date)
    .in("status", ["submitted", "confirmed", "preparing"])) as {
    data: Array<{ id: string; status: string; supplier_notes: string | null }> | null;
  };
  const stillPreparing = (due ?? []).filter((s) =>
    ["confirmed", "preparing"].includes(getWorkflowState(s.status, s.supplier_notes)),
  ).length;

  return {
    date,
    stops: ordered,
    savedOrder,
    canSaveOrder,
    origin,
    originQuery,
    suggestedIds: suggested.map((s) => s.id),
    suggestedKm: routeKm(suggested, origin),
    currentKm: routeKm(ordered, origin),
    stillPreparing,
  };
}
