/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/supplier/context";
import { emitOrderEvent } from "@/lib/orders/events";
import { dispatchEvent } from "@/lib/notifications/dispatcher";
import type { DeliveryStatus } from "@/types/database";
import {
  MarkDeliveredSchema,
  UploadPodSchema,
  type MarkDeliveredInput,
  type UploadPodInput,
} from "./schemas";

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const PROOFS_BUCKET = "delivery-proofs";
const PROOF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function revalidateAll(deliveryId?: string) {
  revalidatePath("/supplier/consegne");
  revalidatePath("/supplier/dashboard");
  if (deliveryId) revalidatePath(`/supplier/consegne/${deliveryId}`);
}

const UuidSchema = z.string().uuid("ID non valido");

export const AssignDriverSchema = z.object({
  deliveryId: UuidSchema,
  driverMemberId: UuidSchema.nullable(),
});

export const MarkFailedActionSchema = z.object({
  deliveryId: UuidSchema,
  reason: z.string().trim().min(3, "Indica un motivo"),
});

type DeliveryCtx = {
  id: string;
  status: DeliveryStatus;
  supplier_id: string;
  order_split_id: string;
  driver_member_id: string | null;
  restaurant_profile_id: string | null;
};

async function loadDelivery(deliveryId: string): Promise<DeliveryCtx | null> {
  const supabase = await createClient();
  const { data } = (await (supabase as any)
    .from("deliveries")
    .select(
      `id, status, driver_member_id, order_split_id,
       order_splits:order_split_id (
         supplier_id,
         orders:order_id ( restaurants:restaurant_id ( profile_id ) )
       )`,
    )
    .eq("id", deliveryId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          status: DeliveryStatus;
          driver_member_id: string | null;
          order_split_id: string;
          order_splits: {
            supplier_id: string;
            orders: {
              restaurants: { profile_id: string | null } | null;
            } | null;
          } | null;
        }
      | null;
  };
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    supplier_id: data.order_splits?.supplier_id ?? "",
    order_split_id: data.order_split_id,
    driver_member_id: data.driver_member_id,
    restaurant_profile_id:
      data.order_splits?.orders?.restaurants?.profile_id ?? null,
  };
}

/**
 * Controllo applicativo: un membro con ruolo `driver` può eseguire azioni
 * solo sulle consegne a lui assegnate (RLS copre la lettura, qui irrigidiamo
 * la scrittura al layer app).
 */
async function assertDriverAuthorized(ctx: DeliveryCtx): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non autenticato");

  const { data: member } = (await (supabase as any)
    .from("supplier_members")
    .select("id, role")
    .eq("supplier_id", ctx.supplier_id)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .not("accepted_at", "is", null)
    .maybeSingle()) as { data: { id: string; role: string } | null };

  if (!member) throw new Error("Non sei membro del fornitore");
  if (
    member.role === "driver" &&
    ctx.driver_member_id &&
    ctx.driver_member_id !== member.id
  ) {
    throw new Error("Questa consegna è assegnata a un altro autista");
  }
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
    revalidateAll(parsed.data.deliveryId);
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
 * Emette evento `shipped` sullo split collegato con notifica al ristorante.
 */
export async function startTransit(deliveryId: string): Promise<Result> {
  try {
    const parsed = UuidSchema.safeParse(deliveryId);
    if (!parsed.success) return { ok: false, error: "ID non valido" };
    const d = await loadDelivery(parsed.data);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    if (d.status !== "planned" && d.status !== "loaded") {
      return {
        ok: false,
        error: `Impossibile partire da stato "${d.status}"`,
      };
    }
    await requirePermission(d.supplier_id, "delivery.execute");
    await assertDriverAuthorized(d);

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({ status: "in_transit" as DeliveryStatus })
      .eq("id", parsed.data);
    if (error) return { ok: false, error: error.message };

    await emitOrderEvent(supabase as any, {
      splitId: d.order_split_id,
      eventType: "shipped",
      supplierId: d.supplier_id,
      driverMemberId: d.driver_member_id ?? null,
      restaurantProfileIds: d.restaurant_profile_id
        ? [d.restaurant_profile_id]
        : undefined,
      notificationPayload: { deliveryId: d.id },
    });

    revalidateAll(parsed.data);
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
 * Carica una foto POD (bytes base64) sul bucket `delivery-proofs` sotto il
 * path `{supplier_id}/{delivery_id}/pod-{ts}.{ext}` e ritorna il path da
 * salvare poi con `markDelivered`.
 */
export async function uploadPodPhoto(
  input: UploadPodInput,
): Promise<Result<{ path: string }>> {
  try {
    const parsed = UploadPodSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati POD non validi",
      };
    }
    const v = parsed.data;

    const d = await loadDelivery(v.delivery_id);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    await requirePermission(d.supplier_id, "delivery.execute");
    await assertDriverAuthorized(d);

    const buffer = Buffer.from(v.bytes_base64, "base64");
    if (buffer.byteLength === 0) return { ok: false, error: "File vuoto" };
    if (buffer.byteLength > PROOF_MAX_BYTES) {
      return { ok: false, error: "Foto troppo grande (max 5 MB)" };
    }

    const ext = v.mime_type === "image/png"
      ? "png"
      : v.mime_type === "image/webp"
        ? "webp"
        : "jpg";
    const path = `${d.supplier_id}/${d.id}/pod-${Date.now()}.${ext}`;

    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from(PROOFS_BUCKET)
      .upload(path, buffer, {
        contentType: v.mime_type,
        upsert: true,
        cacheControl: "3600",
      });
    if (upErr) return { ok: false, error: upErr.message };

    return { ok: true, data: { path } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore upload POD",
    };
  }
}

/**
 * Chiude la consegna come `delivered`. Upload firma PNG (base64 data URL) sul
 * bucket `delivery-proofs` sotto il path
 * `{supplier_id}/{delivery_id}/signature-{ts}.png`, persiste URL + timestamp
 * ed emette evento `delivered` con notifica al ristorante.
 */
export async function markDelivered(
  input: MarkDeliveredInput,
): Promise<Result<{ signature_url: string; pod_photo_url: string | null }>> {
  try {
    const parsed = MarkDeliveredSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const v = parsed.data;

    const d = await loadDelivery(v.delivery_id);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    if (d.status === "delivered") {
      return { ok: false, error: "Consegna già chiusa" };
    }
    if (d.status === "failed") {
      return { ok: false, error: "Consegna già registrata come fallita" };
    }
    await requirePermission(d.supplier_id, "delivery.execute");
    await assertDriverAuthorized(d);

    // Decode data URL (prefix `data:image/png;base64,` già validato dallo schema).
    const base64 = v.signature_data_url.split(",")[1] ?? "";
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength === 0) return { ok: false, error: "Firma vuota" };
    if (buffer.byteLength > PROOF_MAX_BYTES) {
      return { ok: false, error: "Firma troppo grande" };
    }

    const sigPath = `${d.supplier_id}/${d.id}/signature-${Date.now()}.png`;
    const admin = createAdminClient();
    const { error: upErr } = await admin.storage
      .from(PROOFS_BUCKET)
      .upload(sigPath, buffer, {
        contentType: "image/png",
        upsert: true,
        cacheControl: "3600",
      });
    if (upErr) return { ok: false, error: upErr.message };

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({
        status: "delivered" as DeliveryStatus,
        delivered_at: new Date().toISOString(),
        recipient_signature_url: sigPath,
        pod_photo_url: v.pod_photo_url ?? null,
        notes: v.notes ?? undefined,
      })
      .eq("id", v.delivery_id);
    if (error) return { ok: false, error: error.message };

    await emitOrderEvent(supabase as any, {
      splitId: d.order_split_id,
      eventType: "delivered",
      supplierId: d.supplier_id,
      restaurantProfileIds: d.restaurant_profile_id
        ? [d.restaurant_profile_id]
        : undefined,
      notificationPayload: {
        deliveryId: d.id,
        signaturePath: sigPath,
      },
    });

    revalidateAll(v.delivery_id);
    return {
      ok: true,
      data: {
        signature_url: sigPath,
        pod_photo_url: v.pod_photo_url ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore chiusura consegna",
    };
  }
}

/**
 * Segna la consegna come `failed` con motivo obbligatorio e notifica
 * admin+sales (canali email+push da matrice spec §8.2 `delivery_failed`).
 */
export async function markFailed(input: {
  deliveryId: string;
  reason: string;
}): Promise<Result> {
  try {
    const parsed = MarkFailedActionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dati non validi",
      };
    }
    const d = await loadDelivery(parsed.data.deliveryId);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    if (d.status === "delivered" || d.status === "failed") {
      return {
        ok: false,
        error: "Consegna già chiusa",
      };
    }
    await requirePermission(d.supplier_id, "delivery.execute");
    await assertDriverAuthorized(d);

    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("deliveries")
      .update({
        status: "failed" as DeliveryStatus,
        failure_reason: parsed.data.reason,
      })
      .eq("id", parsed.data.deliveryId);
    if (error) return { ok: false, error: error.message };

    try {
      await dispatchEvent(
        "delivery_failed",
        d.supplier_id,
        {
          deliveryId: d.id,
          splitId: d.order_split_id,
          reason: parsed.data.reason,
        },
        { driverMemberId: d.driver_member_id ?? null },
      );
    } catch (err) {
      console.error("[delivery:markFailed] dispatchEvent failed", err);
    }

    revalidateAll(parsed.data.deliveryId);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Errore registrazione esito",
    };
  }
}

/**
 * Signed URL (10 min) per mostrare un artifact (firma/POD) dalla pagina di
 * dettaglio. Verifica permesso e coerenza di path `supplier/delivery`.
 */
export async function getSignedProofUrl(
  deliveryId: string,
  path: string,
): Promise<Result<{ url: string }>> {
  try {
    const d = await loadDelivery(deliveryId);
    if (!d) return { ok: false, error: "Consegna non trovata" };
    await requirePermission(d.supplier_id, "delivery.execute");

    if (!path.startsWith(`${d.supplier_id}/${d.id}/`)) {
      return { ok: false, error: "Path non coerente con la consegna" };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(PROOFS_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Signed URL non creato" };
    }
    return { ok: true, data: { url: data.signedUrl } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore signed URL",
    };
  }
}
