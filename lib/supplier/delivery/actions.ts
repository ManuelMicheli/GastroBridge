/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/supplier/context";
import type { DeliveryStatus } from "@/types/database";

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/supplier/consegne");
  revalidatePath("/supplier/dashboard");
}

const UuidSchema = z.string().uuid("ID non valido");

export const AssignDriverSchema = z.object({
  deliveryId: UuidSchema,
  driverMemberId: UuidSchema.nullable(),
});

export const MarkFailedSchema = z.object({
  deliveryId: UuidSchema,
  reason: z.string().min(3, "Indica un motivo"),
});

async function loadDelivery(deliveryId: string): Promise<
  | {
      id: string;
      status: DeliveryStatus;
      supplier_id: string;
      order_split_id: string;
    }
  | null
> {
  const supabase = await createClient();
  const { data } = (await (supabase as any)
    .from("deliveries")
    .select(
      "id, status, order_splits:order_split_id ( supplier_id ), order_split_id",
    )
    .eq("id", deliveryId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          status: DeliveryStatus;
          order_split_id: string;
          order_splits: { supplier_id: string } | null;
        }
      | null;
  };
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    supplier_id: data.order_splits?.supplier_id ?? "",
    order_split_id: data.order_split_id,
  };
}

/**
 * Assegna (o rimuove) il driver di una consegna. Richiede `delivery.plan`.
 */
export async function assignDriver(input: {
  deliveryId: string;
  driverMemberId: string | null;
}): Promise<Result> {
  try {
    const parsed = AssignDriverSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const d = await loadDelivery(parsed.data.deliveryId);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    await requirePermission(d.supplier_id, "delivery.plan");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({ driver_member_id: parsed.data.driverMemberId })
      .eq("id", parsed.data.deliveryId);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore assegnazione driver",
    };
  }
}

/**
 * Passa la consegna in `in_transit`. Consentito solo da `planned` o `loaded`.
 * Richiede `delivery.execute`.
 */
export async function startTransit(
  deliveryId: string,
): Promise<Result> {
  try {
    const parsedId = UuidSchema.safeParse(deliveryId);
    if (!parsedId.success) return { ok: false, error: "ID non valido" };
    const d = await loadDelivery(parsedId.data);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    if (d.status !== "planned" && d.status !== "loaded") {
      return {
        ok: false,
        error: `Impossibile partire da stato "${d.status}"`,
      };
    }
    await requirePermission(d.supplier_id, "delivery.execute");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({ status: "in_transit" as DeliveryStatus })
      .eq("id", parsedId.data);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore avvio trasporto",
    };
  }
}

/**
 * Segna la consegna come consegnata; imposta `delivered_at = now()`.
 * Richiede `delivery.execute`.
 */
export async function markDelivered(
  deliveryId: string,
): Promise<Result> {
  try {
    const parsedId = UuidSchema.safeParse(deliveryId);
    if (!parsedId.success) return { ok: false, error: "ID non valido" };
    const d = await loadDelivery(parsedId.data);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    if (d.status === "delivered") {
      return { ok: false, error: "Consegna già chiusa" };
    }
    await requirePermission(d.supplier_id, "delivery.execute");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({
        status: "delivered" as DeliveryStatus,
        delivered_at: new Date().toISOString(),
      })
      .eq("id", parsedId.data);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore chiusura consegna",
    };
  }
}

/**
 * Segna la consegna come fallita, con motivo obbligatorio.
 * Richiede `delivery.execute`.
 */
export async function markFailed(input: {
  deliveryId: string;
  reason: string;
}): Promise<Result> {
  try {
    const parsed = MarkFailedSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const d = await loadDelivery(parsed.data.deliveryId);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    await requirePermission(d.supplier_id, "delivery.execute");

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({
        status: "failed" as DeliveryStatus,
        failure_reason: parsed.data.reason.trim(),
      })
      .eq("id", parsed.data.deliveryId);
    if (error) return { ok: false, error: error.message };
    revalidateAll();
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore registrazione esito",
    };
  }
}
