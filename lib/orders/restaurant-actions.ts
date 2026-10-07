/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitOrderEvent } from "@/lib/orders/events";
import { encodeWorkflowNotes, getWorkflowState } from "@/lib/orders/workflow-state";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Restaurant-side cancellation.
 *
 * Only allowed while no supplier has taken the order in charge: every split
 * must still be `submitted` (received, not accepted/modified). In that state
 * no stock has been reserved, so cancelling has no warehouse side effects.
 * Later states go through the supplier (cancelOrderSplit releases stock).
 *
 * Authorization: the user must own the order's restaurant. Split writes use
 * the admin client because restaurants have no UPDATE policy on order_splits.
 */
export async function cancelOrderByRestaurant(orderId: string): Promise<Result> {
  if (!orderId) return { ok: false, error: "Ordine non valido" };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sessione scaduta, effettua di nuovo l'accesso" };

    const admin = createAdminClient() as any;
    const { data: order } = (await admin
      .from("orders")
      .select("id, status, restaurants:restaurant_id ( profile_id )")
      .eq("id", orderId)
      .maybeSingle()) as {
      data: { id: string; status: string; restaurants: { profile_id: string | null } | null } | null;
    };
    if (!order || order.restaurants?.profile_id !== user.id) {
      return { ok: false, error: "Ordine non trovato" };
    }
    if (order.status === "cancelled") return { ok: true };

    const { data: splits } = (await admin
      .from("order_splits")
      .select("id, supplier_id, status, supplier_notes")
      .eq("order_id", orderId)) as {
      data: { id: string; supplier_id: string; status: string; supplier_notes: string | null }[] | null;
    };

    if ((splits ?? []).length === 0 && order.status !== "submitted" && order.status !== "draft") {
      return { ok: false, error: "Questo ordine non può più essere annullato" };
    }

    const notCancellable = (splits ?? []).filter(
      (s) =>
        getWorkflowState(s.status, s.supplier_notes) !== "submitted" &&
        getWorkflowState(s.status, s.supplier_notes) !== "cancelled",
    );
    if (notCancellable.length > 0) {
      return {
        ok: false,
        error:
          "Il fornitore ha già preso in carico l'ordine: contattalo per annullarlo",
      };
    }

    for (const s of splits ?? []) {
      if (getWorkflowState(s.status, s.supplier_notes) === "cancelled") continue;
      const { error } = await admin
        .from("order_splits")
        .update({
          status: "cancelled",
          supplier_notes: encodeWorkflowNotes("cancelled", s.supplier_notes),
        })
        .eq("id", s.id)
        .eq("status", "submitted");
      if (error) return { ok: false, error: error.message };
      await emitOrderEvent(admin, {
        splitId: s.id,
        eventType: "canceled",
        supplierId: s.supplier_id,
        note: "Ordine annullato dal ristorante",
      });
    }

    // Header (catalog orders have only this) — restaurant owner policy.
    const { error: orderErr } = await (supabase as any)
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    if (orderErr) return { ok: false, error: orderErr.message };

    revalidatePath("/ordini");
    revalidatePath(`/ordini/${orderId}`);
    revalidatePath("/dashboard");
    revalidatePath("/supplier/ordini");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Errore annullamento ordine" };
  }
}
