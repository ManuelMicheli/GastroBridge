/* eslint-disable @typescript-eslint/no-explicit-any */
// Le RPC `reserve_split_tx` / `unreserve_split_tx` non sono ancora tipizzate
// dai types generati (migration 20260419100001). `as any` e' necessario sul
// client Supabase per invocarle.
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveSupplierMember, requirePermission } from "@/lib/supplier/context";

export type ReservationConflict = {
  order_split_item_id: string;
  product_id: string;
  requested: number;
  available: number;
};

export type ReservationAllocation = {
  lot_id: string;
  lot_code: string;
  quantity_base: number;
};

export type ReservationPlan = {
  order_split_item_id: string;
  product_id: string;
  quantity_reserved: number;
  allocations: ReservationAllocation[];
};

export type ReserveResult =
  | { ok: true; reservations: ReservationPlan[] }
  | { ok: false; conflicts: ReservationConflict[]; error?: string }
  | { ok: false; error: string };

export type UnreserveResult =
  | { ok: true; released: Array<{ lot_id: string; quantity_base: number }> }
  | { ok: false; error: string };

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function revalidateAfterReservation() {
  revalidatePath("/supplier/magazzino");
  revalidatePath("/supplier/magazzino/movimenti");
  revalidatePath("/supplier/ordini");
}

/**
 * Prenota lo stock per tutte le righe `accepted`/`modified` di un `order_split`
 * utilizzando FEFO. L'intera operazione avviene in un'unica transazione lato
 * Postgres (`reserve_split_tx`) con `SELECT ... FOR UPDATE` sui lotti, in modo
 * da serializzare tentativi concorrenti (spec §7.6).
 *
 * Comportamento:
 * - Se almeno una riga non ha stock sufficiente → NON prenota nulla, scrive un
 *   evento `stock_conflict` su `order_split_events` e ritorna i conflitti.
 * - Per ogni allocazione FEFO, scrive un movimento `order_reserve` con
 *   `quantity_base = -qty` e aggiorna `stock_lots.quantity_reserved_base`.
 */
export async function reserveStockForSplit(
  supplierId: string,
  splitId: string,
): Promise<ReserveResult> {
  try {
    await requirePermission(supplierId, "order.accept_line");

    const supabase = await createClient();
    const member = (await getActiveSupplierMember(supplierId)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) {
      return { ok: false, error: "Membro fornitore non trovato" };
    }

    // Difesa in profondita': verifica che lo split appartenga al supplier.
    const { data: split, error: splitErr } = await supabase
      .from("order_splits")
      .select("id, supplier_id, warehouse_id")
      .eq("id", splitId)
      .maybeSingle<{ id: string; supplier_id: string; warehouse_id: string | null }>();
    if (splitErr) return { ok: false, error: splitErr.message };
    if (!split || split.supplier_id !== supplierId) {
      return { ok: false, error: "Split ordine non valido" };
    }
    if (!split.warehouse_id) {
      return { ok: false, error: "Magazzino non assegnato allo split" };
    }

    const { data, error } = await (supabase.rpc as any)("reserve_split_tx", {
      p_split_id: splitId,
      p_member_id: member.id,
    });
    if (error) {
      return { ok: false, error: error.message ?? "Errore prenotazione stock" };
    }

    const payload = (data ?? {}) as {
      ok?: boolean;
      conflicts?: ReservationConflict[];
      reservations?: ReservationPlan[];
    };

    if (payload.ok === false) {
      return {
        ok: false,
        conflicts: payload.conflicts ?? [],
        error: "Stock insufficiente per uno o piu prodotti",
      };
    }

    revalidateAfterReservation();
    return { ok: true, reservations: payload.reservations ?? [] };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore prenotazione stock") };
  }
}

/**
 * Rilascia la prenotazione stock per un `order_split` (es. cancellazione
 * post-conferma). Calcola la quantita' netta riservata per lotto a partire dai
 * movimenti `order_reserve` / `order_unreserve` gia' registrati e scrive i
 * movimenti di compensazione, azzerando `quantity_reserved_base` sui lotti.
 */
export async function unreserveStockForSplit(
  supplierId: string,
  splitId: string,
): Promise<UnreserveResult> {
  try {
    await requirePermission(supplierId, "order.accept_line");

    const supabase = await createClient();
    const member = (await getActiveSupplierMember(supplierId)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) {
      return { ok: false, error: "Membro fornitore non trovato" };
    }

    const { data: split, error: splitErr } = await supabase
      .from("order_splits")
      .select("id, supplier_id")
      .eq("id", splitId)
      .maybeSingle<{ id: string; supplier_id: string }>();
    if (splitErr) return { ok: false, error: splitErr.message };
    if (!split || split.supplier_id !== supplierId) {
      return { ok: false, error: "Split ordine non valido" };
    }

    const { data, error } = await (supabase.rpc as any)("unreserve_split_tx", {
      p_split_id: splitId,
      p_member_id: member.id,
    });
    if (error) {
      return { ok: false, error: error.message ?? "Errore rilascio prenotazione" };
    }

    const payload = (data ?? {}) as {
      ok?: boolean;
      released?: Array<{ lot_id: string; quantity_base: number }>;
    };

    revalidateAfterReservation();
    return { ok: true, released: payload.released ?? [] };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore rilascio prenotazione") };
  }
}
