/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

/**
 * Plan 1C Task 7 — Server actions fornitore per il workflow ordini.
 *
 * Espone 4 azioni:
 * - `acceptOrderLines`  — update bulk di `order_split_items` con decisione
 *                         accept/modify/reject per ogni riga pending. Coordina
 *                         la transizione dello split (confirmed / cancelled /
 *                         pending_customer_confirmation) e la prenotazione
 *                         stock FEFO via `reserveStockForSplit`.
 * - `markPacked`        — transizione allo stato `packed` (imballato).
 * - `confirmCustomerResponse` — endpoint usato dalla pagina ristorante
 *                         `/ordini/[id]/conferma` per approvare o rifiutare
 *                         modifiche quantità proposte dal fornitore.
 * - `cancelOrderSplit`  — cancellazione fornitore, con rilascio eventuale
 *                         prenotazione stock.
 *
 * Deviazioni note rispetto al plan:
 * - L'enum `order_status` (migration 20260325000001) contiene solo
 *   `draft|submitted|confirmed|preparing|shipping|delivered|cancelled`, senza
 *   i valori `packed`, `rejected`, `pending_customer_confirmation`,
 *   `stock_conflict`. Per non forzare una nuova migration dal Task 7, questi
 *   sotto-stati di workflow sono encodati nel campo testuale
 *   `order_splits.supplier_notes` con prefisso `[workflow:<stato>]` e lo stato
 *   enum viene mappato al valore ammesso piu' vicino (vedi `WORKFLOW_STATE_MAP`).
 *   Il valore reale di workflow resta leggibile tramite `getWorkflowState()`.
 * - Il token HMAC per la pagina di conferma cliente e' stateless (HMAC-SHA256 su
 *   `{splitId, exp}`, TTL 48h) firmato con `AUTH_SECRET` con fallback a
 *   `SUPABASE_JWT_SECRET`. Il single-use via `consumed_at` non e' implementato
 *   in questo task (opzionale in review — vedi plan §13.2).
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getActiveSupplierMember, requirePermission } from "@/lib/supplier/context";
import { emitOrderEvent, emitSplitEvent } from "@/lib/orders/events";
import {
  reserveStockForSplit,
  unreserveStockForSplit,
  type ReservationConflict,
} from "@/lib/supplier/orders/reservation";
import { sendEmail } from "@/lib/notifications/email";
import {
  CUSTOMER_CONFIRM_TTL_MS,
  signCustomerConfirmationToken,
  verifyCustomerConfirmationToken,
} from "./customer-confirmation-token";
import {
  encodeWorkflowNotes,
  getWorkflowState,
  stripWorkflowTag,
  WORKFLOW_STATE_MAP,
  type WorkflowState,
} from "./workflow-state";

// NOTE: Next.js "use server" modules can only export async functions at runtime.
// Turbopack occasionally mis-compiles type re-exports here into value exports,
// which triggers runtime "ReferenceError: WorkflowState is not defined".
// Consumers must import `WorkflowState` and other non-async helpers directly
// from "@/lib/orders/workflow-state".

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type LineDecision =
  | { lineId: string; action: "accept"; quantityAccepted?: number }
  | { lineId: string; action: "modify"; quantityAccepted: number }
  | { lineId: string; action: "reject"; rejectionReason?: string };

export type AcceptOrderLinesInput = {
  splitId: string;
  decisions: LineDecision[];
};

export type AcceptOrderLinesResult =
  | {
      ok: true;
      data: {
        splitStatus: WorkflowState | "confirmed" | "cancelled";
        conflicts?: ReservationConflict[];
      };
    }
  | { ok: false; error: string };

export type SimpleResult =
  | { ok: true; data: { splitStatus: WorkflowState } }
  | { ok: false; error: string };

async function setSplitWorkflow(
  supabase: SupabaseClient<any, any, any>,
  splitId: string,
  state: WorkflowState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Fetch current notes to preserve text content.
  const { data: current, error: readErr } = await (supabase as any)
    .from("order_splits")
    .select("supplier_notes")
    .eq("id", splitId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  const newStatus = WORKFLOW_STATE_MAP[state];
  const newNotes = encodeWorkflowNotes(state, current?.supplier_notes);

  const patch: Record<string, unknown> = {
    status: newStatus,
    supplier_notes: newNotes,
  };
  if (state === "confirmed") patch.confirmed_at = new Date().toISOString();

  const { error } = await (supabase as any)
    .from("order_splits")
    .update(patch)
    .eq("id", splitId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function loadSplitForSupplier(
  supabase: SupabaseClient<any, any, any>,
  splitId: string,
): Promise<
  | {
      ok: true;
      split: {
        id: string;
        supplier_id: string;
        order_id: string;
        status: string;
        supplier_notes: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const { data, error } = await (supabase as any)
    .from("order_splits")
    .select("id, supplier_id, order_id, status, supplier_notes")
    .eq("id", splitId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Split ordine non trovato" };
  return { ok: true, split: data };
}

function revalidateSupplierOrders(splitId: string) {
  revalidatePath("/supplier/ordini");
  revalidatePath(`/supplier/ordini/${splitId}`);
  revalidatePath("/ordini");
}

/**
 * Ensure `order_splits.warehouse_id` is populated. If it is already set,
 * returns it. Otherwise picks the supplier's primary warehouse (fallback:
 * first available) and updates the split row. Returns null when the supplier
 * has no warehouse at all — the caller must skip stock reservation in that case.
 */
async function ensureSplitWarehouse(
  supabase: SupabaseClient<any, any, any>,
  splitId: string,
  supplierId: string,
): Promise<string | null> {
  const { data: current } = await (supabase as any)
    .from("order_splits")
    .select("warehouse_id")
    .eq("id", splitId)
    .maybeSingle() as { data: { warehouse_id: string | null } | null };

  if (current?.warehouse_id) return current.warehouse_id;

  const { data: warehouses } = await (supabase as any)
    .from("warehouses")
    .select("id, is_primary")
    .eq("supplier_id", supplierId) as {
      data: Array<{ id: string; is_primary: boolean | null }> | null;
    };

  if (!warehouses || warehouses.length === 0) return null;

  const primary = warehouses.find((w) => w.is_primary) ?? warehouses[0]!;

  const { error: upErr } = await (supabase as any)
    .from("order_splits")
    .update({ warehouse_id: primary.id })
    .eq("id", splitId);
  if (upErr) return null;

  return primary.id;
}

// -----------------------------------------------------------------------------
// acceptOrderLines
// -----------------------------------------------------------------------------

/**
 * Applica le decisioni del fornitore sulle righe di uno split. Le decisioni
 * devono coprire tutte le righe `pending`: se ne manca una l'operazione viene
 * rifiutata (difensivo, evita transizioni parziali).
 *
 * Esiti globali:
 *  - tutte `accept` → split `confirmed` + `reserveStockForSplit` (se conflict
 *    → workflow `stock_conflict`, evento `stock_conflict`);
 *  - almeno una `modify` o `reject` parziale → workflow
 *    `pending_customer_confirmation`, email al ristorante con link HMAC;
 *  - tutte `reject` → workflow `rejected`, niente prenotazione.
 */
export async function acceptOrderLines(
  input: AcceptOrderLinesInput,
): Promise<AcceptOrderLinesResult> {
  const { splitId, decisions } = input;

  if (!splitId) return { ok: false, error: "splitId mancante" };
  if (!Array.isArray(decisions) || decisions.length === 0) {
    return { ok: false, error: "Nessuna decisione fornita" };
  }

  try {
    const supabase = await createClient();

    // 1. Load split + supplier id.
    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    // 2. Auth + permission.
    await requirePermission(split.supplier_id, "order.accept_line");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    // 3. Carica righe pending dello split.
    const { data: lines, error: linesErr } = await (supabase as any)
      .from("order_split_items")
      .select("id, status, quantity_requested")
      .eq("order_split_id", splitId);
    if (linesErr) return { ok: false, error: linesErr.message };

    const pendingIds = new Set(
      (lines as Array<{ id: string; status: string }>).filter((l) => l.status === "pending").map((l) => l.id),
    );
    if (pendingIds.size === 0) {
      return { ok: false, error: "Nessuna riga in attesa di accettazione" };
    }

    // 4. Valida copertura: le decisioni coprono tutte e sole le righe pending.
    const decisionById = new Map<string, LineDecision>();
    for (const d of decisions) {
      if (decisionById.has(d.lineId)) {
        return { ok: false, error: `Decisione duplicata per la riga ${d.lineId}` };
      }
      decisionById.set(d.lineId, d);
    }
    for (const pid of pendingIds) {
      if (!decisionById.has(pid)) {
        return {
          ok: false,
          error: "Devi decidere per tutte le righe in attesa prima di confermare",
        };
      }
    }
    for (const d of decisions) {
      if (!pendingIds.has(d.lineId)) {
        return {
          ok: false,
          error: `Riga ${d.lineId} non e' in stato pending`,
        };
      }
    }

    // 5. Valida quantita' per modify.
    const linesById = new Map(
      (lines as Array<{ id: string; quantity_requested: number }>).map((l) => [l.id, l]),
    );
    for (const d of decisions) {
      if (d.action === "modify") {
        const ln = linesById.get(d.lineId);
        if (!ln) return { ok: false, error: `Riga ${d.lineId} non trovata` };
        if (!(d.quantityAccepted > 0)) {
          return { ok: false, error: "La quantita' modificata deve essere positiva" };
        }
        if (d.quantityAccepted > ln.quantity_requested * 2) {
          return {
            ok: false,
            error: "Quantita' modificata troppo elevata rispetto alla richiesta",
          };
        }
      }
    }

    // 6. Esegui gli UPDATE per ogni decisione.
    const counts = { accept: 0, modify: 0, reject: 0 };
    for (const d of decisions) {
      const ln = linesById.get(d.lineId)!;
      let patch: Record<string, unknown>;

      if (d.action === "accept") {
        patch = {
          status: "accepted",
          quantity_accepted: ln.quantity_requested,
          rejection_reason: null,
        };
        counts.accept++;
      } else if (d.action === "modify") {
        patch = {
          status: "modified",
          quantity_accepted: d.quantityAccepted,
          rejection_reason: null,
        };
        counts.modify++;
      } else {
        patch = {
          status: "rejected",
          quantity_accepted: 0,
          rejection_reason: d.rejectionReason ?? null,
        };
        counts.reject++;
      }

      const { error: upErr } = await (supabase as any)
        .from("order_split_items")
        .update(patch)
        .eq("id", d.lineId);
      if (upErr) {
        return { ok: false, error: `Aggiornamento riga fallito: ${upErr.message}` };
      }
    }

    // 7. Determina esito globale.
    const totalDecisions = decisions.length;

    // Caso A: tutte accepted → confirmed (+ reserve, se magazzino presente).
    if (counts.accept === totalDecisions) {
      // Best-effort: se lo split non ha warehouse_id, prova ad assegnarne uno
      // automaticamente (primary del supplier → fallback primo disponibile).
      // Se il supplier non ha alcun magazzino, la prenotazione stock viene
      // saltata e l'ordine viene comunque confermato.
      const warehouseId = await ensureSplitWarehouse(supabase, splitId, split.supplier_id);

      if (warehouseId) {
        const reserve = await reserveStockForSplit(split.supplier_id, splitId);
        if (!reserve.ok && "conflicts" in reserve && reserve.conflicts) {
          await setSplitWorkflow(supabase, splitId, "stock_conflict");
          await emitSplitEvent(supabase, {
            splitId,
            eventType: "stock_conflict",
            memberId: member.id,
            metadata: { conflicts: reserve.conflicts },
          });
          revalidateSupplierOrders(splitId);
          return {
            ok: true,
            data: { splitStatus: "stock_conflict", conflicts: reserve.conflicts },
          };
        }
        if (!reserve.ok) {
          return { ok: false, error: reserve.error ?? "Errore prenotazione stock" };
        }
      }

      const wf = await setSplitWorkflow(supabase, splitId, "confirmed");
      if (!wf.ok) return wf;
      await emitOrderEvent(supabase, {
        splitId,
        eventType: "accepted",
        memberId: member.id,
        supplierId: split.supplier_id,
        notificationPayload: {},
      });
      revalidateSupplierOrders(splitId);
      return { ok: true, data: { splitStatus: "confirmed" } };
    }

    // Caso B: tutte rejected → rejected, niente prenotazione.
    if (counts.reject === totalDecisions) {
      const wf = await setSplitWorkflow(supabase, splitId, "rejected");
      if (!wf.ok) return wf;
      await emitOrderEvent(supabase, {
        splitId,
        eventType: "rejected",
        memberId: member.id,
        supplierId: split.supplier_id,
      });
      revalidateSupplierOrders(splitId);
      return { ok: true, data: { splitStatus: "rejected" as WorkflowState } };
    }

    // Caso C: mix modify/reject/accept → pending_customer_confirmation.
    const wf = await setSplitWorkflow(
      supabase,
      splitId,
      "pending_customer_confirmation",
    );
    if (!wf.ok) return wf;
    await emitSplitEvent(supabase, {
      splitId,
      eventType: "partially_accepted",
      memberId: member.id,
      metadata: { accept: counts.accept, modify: counts.modify, reject: counts.reject },
    });

    // Email al ristorante con link HMAC.
    await sendCustomerConfirmationEmail(supabase, splitId).catch((err) => {
      console.error("[supplier-actions] customer confirmation email failed", err);
    });

    revalidateSupplierOrders(splitId);
    return {
      ok: true,
      data: { splitStatus: "pending_customer_confirmation" as WorkflowState },
    };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore accettazione ordine") };
  }
}

// -----------------------------------------------------------------------------
// transitionToPreparing — Task 12
// -----------------------------------------------------------------------------

/**
 * Task 12 — Alla prima apertura della pagina di preparazione, se lo split e'
 * in stato workflow `confirmed`, lo portiamo a `preparing` ed emettiamo
 * l'evento `preparing`. Idempotente. Permesso: `order.prepare`.
 */
export async function transitionToPreparing(splitId: string): Promise<SimpleResult> {
  if (!splitId) return { ok: false, error: "splitId mancante" };

  try {
    const supabase = await createClient();

    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    await requirePermission(split.supplier_id, "order.prepare");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    if (currentState === "preparing") {
      return {
        ok: true,
        data: { splitStatus: "preparing" as unknown as WorkflowState },
      };
    }
    if (currentState !== "confirmed") {
      return {
        ok: false,
        error: "Lo split deve essere confermato per iniziare la preparazione",
      };
    }

    // `preparing` e' un valore enum valido di order_status.
    const newNotes = stripWorkflowTag(split.supplier_notes) || null;
    const { error: upErr } = await (supabase as any)
      .from("order_splits")
      .update({ status: "preparing", supplier_notes: newNotes })
      .eq("id", splitId);
    if (upErr) return { ok: false, error: upErr.message };

    await emitSplitEvent(supabase, {
      splitId,
      eventType: "preparing",
      memberId: member.id,
    });

    revalidateSupplierOrders(splitId);
    return {
      ok: true,
      data: { splitStatus: "preparing" as unknown as WorkflowState },
    };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore transizione preparazione") };
  }
}

// -----------------------------------------------------------------------------
// pickItem — Task 12
// -----------------------------------------------------------------------------

export type PickItemInput = {
  splitItemId: string;
  lotId: string;
  quantityBase: number;
};

export type PickItemResult =
  | {
      ok: true;
      data: {
        deliveryId: string;
        lotId: string;
        quantityBase: number;
        quantitySalesUnit: number;
      };
    }
  | { ok: false; error: string };

/**
 * Task 12 — Conferma picking fisico di una riga. Stock gia' prenotato dalla
 * reservation. La transazione (`pick_split_item_tx`):
 *  - FOR UPDATE su split + riga + lotto,
 *  - decrementa `stock_lots.quantity_base` e `quantity_reserved_base` dello
 *    stesso valore (invariante reserved<=base preservata),
 *  - inserisce `stock_movements` type `order_ship` negativo,
 *  - crea/riusa `deliveries` (planned) e inserisce `delivery_items`.
 *
 * Non modifica lo status della riga (`order_line_status` non include
 * `picked`): la UI considera "picked" quando la somma dei `delivery_items`
 * copre `quantity_accepted`.
 */
export async function pickItem(input: PickItemInput): Promise<PickItemResult> {
  const { splitItemId, lotId, quantityBase } = input;
  if (!splitItemId || !lotId) return { ok: false, error: "Parametri mancanti" };
  if (!Number.isFinite(quantityBase) || quantityBase <= 0) {
    return { ok: false, error: "Quantita' non valida" };
  }

  try {
    const supabase = await createClient();

    const { data: item, error: itemErr } = await (supabase as any)
      .from("order_split_items")
      .select("id, order_split_id")
      .eq("id", splitItemId)
      .maybeSingle();
    if (itemErr) return { ok: false, error: itemErr.message };
    if (!item) return { ok: false, error: "Riga non trovata" };

    const splitRes = await loadSplitForSupplier(supabase, item.order_split_id);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    await requirePermission(split.supplier_id, "order.prepare");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    if (currentState !== "confirmed" && currentState !== "preparing") {
      return { ok: false, error: "Lo split non e' in fase di preparazione" };
    }

    const { data, error } = await (supabase.rpc as any)("pick_split_item_tx", {
      p_split_item_id: splitItemId,
      p_lot_id: lotId,
      p_quantity_base: quantityBase,
      p_member_id: member.id,
    });
    if (error) return { ok: false, error: error.message ?? "Errore picking" };

    const payload = (data ?? {}) as {
      ok?: boolean;
      delivery_id?: string;
      lot_id?: string;
      quantity_base?: number;
      quantity_sales_unit?: number;
    };
    if (!payload.ok) return { ok: false, error: "Errore picking" };

    revalidatePath(`/supplier/ordini/${split.id}`);
    revalidatePath(`/supplier/ordini/${split.id}/preparazione`);
    revalidatePath("/supplier/magazzino");
    revalidatePath("/supplier/magazzino/movimenti");

    return {
      ok: true,
      data: {
        deliveryId: payload.delivery_id!,
        lotId: payload.lot_id!,
        quantityBase: payload.quantity_base!,
        quantitySalesUnit: payload.quantity_sales_unit ?? 0,
      },
    };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore picking") };
  }
}

// -----------------------------------------------------------------------------
// markPacked — Task 12
// -----------------------------------------------------------------------------

/**
 * Task 12 — Finalizza il picking via RPC `finalize_split_packing_tx`:
 * verifica che tutte le righe abbiano delivery_items coprenti
 * `quantity_accepted`, porta la delivery da `planned` a `loaded` e marca
 * lo split workflow `packed`.
 *
 * Deviazione: in Task 7 questa action usava `order.accept_line`; Task 12
 * sposta la responsabilita' al magazziniere → `order.prepare`.
 */
export async function markPacked(splitId: string): Promise<SimpleResult> {
  if (!splitId) return { ok: false, error: "splitId mancante" };

  try {
    const supabase = await createClient();

    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    await requirePermission(split.supplier_id, "order.prepare");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    if (currentState !== "confirmed" && currentState !== "preparing") {
      return {
        ok: false,
        error: "Lo split deve essere in preparazione per essere imballato",
      };
    }

    const { error: rpcErr } = await (supabase.rpc as any)(
      "finalize_split_packing_tx",
      { p_split_id: splitId, p_member_id: member.id },
    );
    if (rpcErr) {
      return { ok: false, error: rpcErr.message ?? "Errore finalizzazione" };
    }

    const wf = await setSplitWorkflow(supabase, splitId, "packed");
    if (!wf.ok) return wf;

    await emitSplitEvent(supabase, {
      splitId,
      eventType: "packed",
      memberId: member.id,
    });

    // Task 13 (Plan 1D) — Auto-generate DDT appena le deliveries collegate
    // allo split passano a `loaded` (side-effect di `finalize_split_packing_tx`).
    // Se fallisce (permesso mancante, render PDF, DDT gia' emesso) logghiamo e
    // proseguiamo: il DDT puo' essere generato manualmente dal libro DDT.
    try {
      const { data: loadedDeliveries } = await (supabase as any)
        .from("deliveries")
        .select("id, status")
        .eq("order_split_id", splitId)
        .eq("status", "loaded");
      const rows = Array.isArray(loadedDeliveries) ? loadedDeliveries : [];
      if (rows.length > 0) {
        const { generateDdtForDelivery } = await import(
          "@/lib/supplier/ddt/actions"
        );
        for (const row of rows) {
          try {
            const res = await generateDdtForDelivery(row.id as string);
            if (!res.ok) {
              console.warn(
                "[markPacked] auto-DDT skipped",
                row.id,
                res.error,
              );
            }
          } catch (inner) {
            console.error("[markPacked] auto-DDT error", row.id, inner);
          }
        }
      }
    } catch (err) {
      console.error("[markPacked] auto-DDT lookup failed", err);
    }

    revalidateSupplierOrders(splitId);
    return { ok: true, data: { splitStatus: "packed" } };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore aggiornamento stato") };
  }
}

// -----------------------------------------------------------------------------
// markShipped
// -----------------------------------------------------------------------------

/**
 * Transizione da `packed` a `shipping`. `shipping` e' un valore enum valido di
 * `order_status`, quindi non usiamo il tag workflow (lo rimuoviamo se presente).
 */
export async function markShipped(splitId: string): Promise<SimpleResult> {
  if (!splitId) return { ok: false, error: "splitId mancante" };

  try {
    const supabase = await createClient();

    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    await requirePermission(split.supplier_id, "order.accept_line");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    if (currentState !== "packed") {
      return {
        ok: false,
        error: "Lo split deve essere imballato prima della spedizione",
      };
    }

    const newNotes = stripWorkflowTag(split.supplier_notes) || null;
    const { error: upErr } = await (supabase as any)
      .from("order_splits")
      .update({ status: "shipping", supplier_notes: newNotes })
      .eq("id", splitId);
    if (upErr) return { ok: false, error: upErr.message };

    await emitOrderEvent(supabase, {
      splitId,
      eventType: "shipped",
      memberId: member.id,
      supplierId: split.supplier_id,
    });

    revalidateSupplierOrders(splitId);
    return { ok: true, data: { splitStatus: "shipping" as unknown as WorkflowState } };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore aggiornamento stato") };
  }
}

// -----------------------------------------------------------------------------
// transitionSplitStatus (kanban drag & drop)
// -----------------------------------------------------------------------------

export type KanbanTargetStatus =
  | "preparing"
  | "packed"
  | "shipped"
  | "delivered";

export type TransitionSplitStatusInput = {
  splitId: string;
  targetStatus: KanbanTargetStatus;
};

export type TransitionSplitStatusResult =
  | { ok: true; data: { splitStatus: string } }
  | { ok: false; error: string };

/**
 * Transizioni legali permesse via drag & drop sulla kanban:
 *  - `confirmed → preparing`
 *  - `preparing → packed`
 *  - `packed → shipped`
 *  - `shipped → delivered`
 *
 * Le transizioni `pending*` / `stock_conflict` / `rejected` / `cancelled`
 * richiedono sempre il dettaglio ordine (accettazione per riga): in quei casi
 * l'azione ritorna un errore informativo cosi' il client puo' mostrare un toast.
 */
export async function transitionSplitStatus(
  input: TransitionSplitStatusInput,
): Promise<TransitionSplitStatusResult> {
  const { splitId, targetStatus } = input;
  if (!splitId) return { ok: false, error: "splitId mancante" };
  if (!targetStatus) return { ok: false, error: "targetStatus mancante" };

  const LEGAL: Record<KanbanTargetStatus, string[]> = {
    preparing: ["confirmed"],
    packed: ["preparing"],
    shipped: ["packed"],
    delivered: ["shipping", "shipped"],
  };

  try {
    const supabase = await createClient();

    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    await requirePermission(split.supplier_id, "order.accept_line");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    const allowed = LEGAL[targetStatus];
    if (!allowed || !allowed.includes(currentState)) {
      return {
        ok: false,
        error:
          "Transizione non consentita — apri il dettaglio ordine per gestire questo passaggio",
      };
    }

    const nowIso = new Date().toISOString();

    if (targetStatus === "packed") {
      const wf = await setSplitWorkflow(supabase, splitId, "packed");
      if (!wf.ok) return wf;
      await emitSplitEvent(supabase, {
        splitId,
        eventType: "packed",
        memberId: member.id,
      });
    } else {
      const enumStatus =
        targetStatus === "shipped" ? "shipping" : targetStatus;
      const patch: Record<string, unknown> = {
        status: enumStatus,
        supplier_notes: stripWorkflowTag(split.supplier_notes) || null,
      };
      if (targetStatus === "shipped") patch.shipped_at = nowIso;
      if (targetStatus === "delivered") patch.delivered_at = nowIso;
      const { error } = await (supabase as any)
        .from("order_splits")
        .update(patch)
        .eq("id", splitId);
      if (error) return { ok: false, error: error.message };

      if (targetStatus === "shipped" || targetStatus === "delivered") {
        await emitOrderEvent(supabase, {
          splitId,
          eventType: targetStatus,
          memberId: member.id,
          supplierId: split.supplier_id,
        });
      } else {
        await emitSplitEvent(supabase, {
          splitId,
          eventType: "preparing",
          memberId: member.id,
        });
      }
    }

    revalidateSupplierOrders(splitId);
    revalidatePath("/supplier/ordini/kanban");

    return { ok: true, data: { splitStatus: targetStatus } };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore aggiornamento stato") };
  }
}

// -----------------------------------------------------------------------------
// confirmCustomerResponse
// -----------------------------------------------------------------------------

/**
 * Endpoint usato dalla pagina cliente `/ordini/[id]/conferma` per approvare o
 * rifiutare le modifiche fornitore (stato `pending_customer_confirmation`).
 *
 * Il token HMAC viene verificato stateless (vedi `verifyCustomerConfirmationToken`).
 * Non verifica l'autenticazione utente: chi ha il link email ha diritto di
 * rispondere (use case B2B). Se review richiede hardening, aggiungere controllo
 * `restaurant.profile_id === user.id` e single-use via tabella token.
 */
export async function confirmCustomerResponse(
  splitId: string,
  token: string,
  accepted: boolean,
): Promise<SimpleResult> {
  if (!splitId || !token) {
    return { ok: false, error: "Parametri mancanti" };
  }

  try {
    const verify = verifyCustomerConfirmationToken(token, splitId);
    if (!verify.ok) return { ok: false, error: verify.error };

    const supabase = await createClient();

    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    if (currentState !== "pending_customer_confirmation") {
      return {
        ok: false,
        error: "Lo split non e' in attesa di conferma cliente",
      };
    }

    if (accepted) {
      const reserve = await reserveStockForSplit(split.supplier_id, splitId);
      if (!reserve.ok && "conflicts" in reserve && reserve.conflicts) {
        await setSplitWorkflow(supabase, splitId, "stock_conflict");
        await emitSplitEvent(supabase, {
          splitId,
          eventType: "stock_conflict",
          metadata: { conflicts: reserve.conflicts },
        });
        revalidateSupplierOrders(splitId);
        return { ok: true, data: { splitStatus: "stock_conflict" } };
      }
      if (!reserve.ok) return { ok: false, error: reserve.error ?? "Errore prenotazione stock" };

      const wf = await setSplitWorkflow(supabase, splitId, "confirmed");
      if (!wf.ok) return wf;

      await emitOrderEvent(supabase, {
        splitId,
        eventType: "accepted",
        supplierId: split.supplier_id,
        note: "Conferma ricevuta dal ristorante",
      });
      revalidateSupplierOrders(splitId);
      return { ok: true, data: { splitStatus: "confirmed" } };
    }

    // Rifiuto cliente: cancellazione.
    const wf = await setSplitWorkflow(supabase, splitId, "cancelled");
    if (!wf.ok) return wf;

    await emitSplitEvent(supabase, {
      splitId,
      eventType: "canceled",
      note: "Rifiuto ricevuto dal ristorante",
    });
    revalidateSupplierOrders(splitId);
    return { ok: true, data: { splitStatus: "cancelled" } };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore conferma cliente") };
  }
}

// -----------------------------------------------------------------------------
// cancelOrderSplit
// -----------------------------------------------------------------------------

/**
 * Cancella uno split lato fornitore. Se lo split era `confirmed` (stock
 * prenotato), rilascia la prenotazione via `unreserveStockForSplit` prima di
 * cambiare lo stato.
 */
export async function cancelOrderSplit(splitId: string): Promise<SimpleResult> {
  if (!splitId) return { ok: false, error: "splitId mancante" };

  try {
    const supabase = await createClient();

    const splitRes = await loadSplitForSupplier(supabase, splitId);
    if (!splitRes.ok) return splitRes;
    const split = splitRes.split;

    await requirePermission(split.supplier_id, "order.accept_line");
    const member = (await getActiveSupplierMember(split.supplier_id)) as
      | { id: string; role: string; supplier_id: string }
      | null;
    if (!member) return { ok: false, error: "Membro fornitore non trovato" };

    const currentState = getWorkflowState(split.status, split.supplier_notes);
    if (currentState === "cancelled" || currentState === "rejected") {
      return { ok: false, error: "Lo split e' gia' cancellato" };
    }
    if (currentState === "delivered") {
      return { ok: false, error: "Uno split gia' consegnato non puo' essere cancellato" };
    }

    // Se era confermato o packed → stock era prenotato, rilascialo.
    if (
      currentState === "confirmed" ||
      currentState === "preparing" ||
      currentState === "packed"
    ) {
      const un = await unreserveStockForSplit(split.supplier_id, splitId);
      if (!un.ok) {
        return { ok: false, error: `Rilascio prenotazione fallito: ${un.error}` };
      }
    }

    const wf = await setSplitWorkflow(supabase, splitId, "cancelled");
    if (!wf.ok) return wf;

    await emitSplitEvent(supabase, {
      splitId,
      eventType: "canceled",
      memberId: member.id,
    });

    revalidateSupplierOrders(splitId);
    return { ok: true, data: { splitStatus: "cancelled" as WorkflowState } };
  } catch (err) {
    return { ok: false, error: errMsg(err, "Errore cancellazione split") };
  }
}

// -----------------------------------------------------------------------------
// Customer confirmation email (direct, no dispatcher)
// -----------------------------------------------------------------------------

async function sendCustomerConfirmationEmail(
  supabase: SupabaseClient<any, any, any>,
  splitId: string,
): Promise<void> {
  // Fetch order → restaurant → profile email.
  const { data: joined } = await (supabase as any)
    .from("order_splits")
    .select(
      "id, order_id, orders:order_id ( restaurant_id, restaurants:restaurant_id ( profile_id, name ) )",
    )
    .eq("id", splitId)
    .maybeSingle();

  if (!joined) return;
  const profileId: string | undefined =
    joined?.orders?.restaurants?.profile_id ?? undefined;
  const restaurantName: string =
    joined?.orders?.restaurants?.name ?? "Ristorante";
  if (!profileId) return;

  // Recupera email via admin (profiles non espone email; leggiamo da auth).
  let email: string | undefined;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: authUser } = await (admin as any).auth.admin.getUserById(profileId);
    email = authUser?.user?.email;
  } catch (err) {
    console.warn("[supplier-actions] admin email lookup failed", err);
  }
  if (!email) return;

  const token = signCustomerConfirmationToken(splitId);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  const link = `${baseUrl}/ordini/${splitId}/conferma?token=${encodeURIComponent(token)}`;
  const shortId = splitId.slice(0, 8);

  const title = `Conferma richiesta per l'ordine #${shortId}`;
  const intro = `Il fornitore ha proposto modifiche alle quantita' del tuo ordine. Per completare la conferma apri il link qui sotto entro 48 ore.`;

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f6f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr><td style="background:#16a34a;padding:16px 24px;color:#fff;font-weight:600;font-size:16px;">GastroBridge</td></tr>
        <tr><td style="padding:24px;color:#111;line-height:1.5;font-size:14px;">
          <h1 style="margin:0 0 12px;font-size:18px;">${title}</h1>
          <p>Ciao ${restaurantName},</p>
          <p>${intro}</p>
          <p style="margin:24px 0 0;">
            <a href="${link}" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:500;">Apri conferma ordine</a>
          </p>
          <p style="margin-top:16px;color:#6b7280;font-size:12px;">Se non riconosci questa richiesta, ignora questo messaggio.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `${title}\n\n${intro}\n\nApri: ${link}\n`;

  await sendEmail({ to: email, subject: title, html, text });
}
