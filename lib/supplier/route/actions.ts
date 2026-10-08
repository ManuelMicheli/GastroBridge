/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Giro consegne actions: save the stop order, warn the client of the arrival.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { sendMessage } from "@/lib/messages/actions";
import { resolveRelationshipIdForPair } from "@/lib/messages/context";
import { notifyRestaurants } from "@/lib/supplier/notify-restaurant";

type Result = { ok: true } | { ok: false; error: string };

const SaveOrderSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliveryIds: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Persist the stop order (`deliveries.route_position`). Planners
 * (`delivery.plan`) may order any stop; other roles with `delivery.execute`
 * (drivers) only a route made entirely of their own stops.
 */
export async function saveRouteOrder(input: { date: string; deliveryIds: string[] }): Promise<Result> {
  const parsed = SaveOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dati non validi" };
  const member = await getCurrentSupplierMember();
  if (!member) return { ok: false, error: "Non sei membro di un fornitore" };
  const canPlan = memberCan(member, "delivery.plan");
  if (!canPlan && !memberCan(member, "delivery.execute")) {
    return { ok: false, error: "Il tuo ruolo non gestisce le consegne" };
  }

  const supabase = await createClient();
  const { data: rows, error } = (await (supabase as any)
    .from("deliveries")
    .select("id, scheduled_date, driver_member_id, order_splits:order_split_id ( supplier_id )")
    .in("id", parsed.data.deliveryIds)) as {
    data: Array<{ id: string; scheduled_date: string; driver_member_id: string | null; order_splits: { supplier_id: string } | null }> | null;
    error: { message: string } | null;
  };
  if (error) return { ok: false, error: error.message };
  const found = rows ?? [];
  if (found.length !== parsed.data.deliveryIds.length) return { ok: false, error: "Consegne non trovate" };
  for (const r of found) {
    if (r.order_splits?.supplier_id !== member.supplier_id || r.scheduled_date !== parsed.data.date) {
      return { ok: false, error: "Consegne non valide per questo giro" };
    }
    if (!canPlan && r.driver_member_id !== member.id) {
      return { ok: false, error: "Puoi riordinare solo le tue consegne" };
    }
  }

  for (let i = 0; i < parsed.data.deliveryIds.length; i++) {
    const { error: upErr } = await (supabase as any)
      .from("deliveries")
      .update({ route_position: i + 1 })
      .eq("id", parsed.data.deliveryIds[i]);
    if (upErr) {
      return {
        ok: false,
        error: upErr.message?.includes("route_position")
          ? "Ordine giro non salvabile: applica la migrazione 20261009000000"
          : upErr.message,
      };
    }
  }
  revalidatePath("/supplier/giro");
  return { ok: true };
}

const EtaSchema = z.object({
  deliveryId: z.string().uuid(),
  minutes: z.number().int().min(5).max(240),
});

/**
 * "Avvisa arrivo": message in the order chat + in-app/push notification to
 * the restaurant. Drivers may warn only for their own (or unassigned) stops.
 */
export async function notifyArrival(input: { deliveryId: string; minutes: number }): Promise<Result> {
  const parsed = EtaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tempo di arrivo non valido" };
  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "delivery.execute")) {
    return { ok: false, error: "Il tuo ruolo non esegue consegne" };
  }
  const supabase = await createClient();
  const { data: d } = (await (supabase as any)
    .from("deliveries")
    .select(
      "id, status, driver_member_id, order_split_id, order_splits:order_split_id ( supplier_id, orders:order_id ( restaurant_id ) )",
    )
    .eq("id", parsed.data.deliveryId)
    .maybeSingle()) as {
    data: {
      id: string;
      status: string;
      driver_member_id: string | null;
      order_split_id: string;
      order_splits: { supplier_id: string; orders: { restaurant_id: string } | null } | null;
    } | null;
  };
  if (!d || d.order_splits?.supplier_id !== member.supplier_id || !d.order_splits.orders) {
    return { ok: false, error: "Consegna non trovata" };
  }
  if (member.role === "driver" && d.driver_member_id && d.driver_member_id !== member.id) {
    return { ok: false, error: "Questa consegna è assegnata a un altro autista" };
  }
  if (d.status === "delivered" || d.status === "failed") {
    return { ok: false, error: "La consegna è già chiusa" };
  }

  const restaurantId = d.order_splits.orders.restaurant_id;
  const { data: sup } = (await (supabase as any)
    .from("suppliers")
    .select("company_name")
    .eq("id", member.supplier_id)
    .maybeSingle()) as { data: { company_name: string } | null };
  const supplierName = sup?.company_name ?? "Il fornitore";
  const eta = new Date(Date.now() + parsed.data.minutes * 60_000).toLocaleTimeString("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  });
  const body = `Siamo in arrivo con la vostra consegna: circa ${parsed.data.minutes} minuti (verso le ${eta}).`;

  const relationshipId = await resolveRelationshipIdForPair(restaurantId, member.supplier_id);
  if (relationshipId) {
    await sendMessage({ relationship_id: relationshipId, order_split_id: d.order_split_id, body }).catch(() => null);
  }
  await notifyRestaurants([restaurantId], {
    eventType: "delivery_eta",
    fallbackEventType: "order_shipped",
    title: `${supplierName}: consegna in arrivo`,
    body,
    link: `/ordini/${d.order_split_id}`,
    metadata: { splitId: d.order_split_id, deliveryId: d.id, etaMinutes: parsed.data.minutes },
  });
  return { ok: true };
}
