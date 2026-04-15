/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Plan 1C Task 2 — submitOrder.
 *
 * Server action che invia un ordine esplicito lato ristorante: valida l'input,
 * raggruppa le righe per fornitore (uno split per supplier) e chiama la RPC
 * SQL atomica `create_order_with_splits`, la quale inserisce `orders` +
 * `order_items` + `order_splits` + `order_split_items` + evento iniziale
 * `order_split_events('received')` in un'unica transazione.
 *
 * Ritorna `{ ok: true, data: { orderId, splitIds } }` oppure `{ ok: false, error }`
 * con messaggi in italiano user-friendly.
 */

const submitOrderItemSchema = z.object({
  productId:    z.string().uuid({ message: "productId non valido" }),
  supplierId:   z.string().uuid({ message: "supplierId non valido" }),
  quantity:     z.number().positive({ message: "Quantità deve essere positiva" }),
  unitPrice:    z.number().nonnegative({ message: "Prezzo non valido" }),
  salesUnitId:  z.string().uuid().optional().nullable(),
  notes:        z.string().max(500).optional().nullable(),
});

const submitOrderSchema = z.object({
  restaurantId:        z.string().uuid({ message: "restaurantId non valido" }),
  items:               z.array(submitOrderItemSchema).min(1, "Almeno una riga è richiesta"),
  notes:               z.string().max(2000).optional().nullable(),
  deliveryDate:        z.string().optional().nullable(), // ISO date (yyyy-mm-dd)
  deliveryLocationId:  z.string().uuid().optional().nullable(),
});

export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

export type SubmitOrderResult =
  | { ok: true; data: { orderId: string; splitIds: { supplierId: string; splitId: string }[] } }
  | { ok: false; error: string };

type RpcSplitOut = { supplier_id: string; split_id: string };
type RpcOut = { order_id: string; splits: RpcSplitOut[] };

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  // 1. Validazione input.
  const parsed = submitOrderSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Dati ordine non validi" };
  }
  const data = parsed.data;

  const supabase = await createClient();

  // 2. Verifica utente autenticato.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione scaduta, effettua di nuovo l'accesso" };

  // 3. Verifica che il ristorante appartenga all'utente corrente (RLS-safe).
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, profile_id")
    .eq("id", data.restaurantId)
    .maybeSingle<{ id: string; profile_id: string }>();

  if (!restaurant) return { ok: false, error: "Ristorante non trovato" };
  if (restaurant.profile_id !== user.id) {
    return { ok: false, error: "Non sei autorizzato a ordinare per questo ristorante" };
  }

  // 4. Raggruppa righe per fornitore → uno split per supplier.
  type SplitPayload = {
    supplier_id: string;
    subtotal: number;
    warehouse_id: string | null;
    expected_delivery_date: string | null;
    delivery_zone_id: string | null;
    items: {
      product_id: string;
      sales_unit_id: string | null;
      quantity: number;
      unit_price: number;
      notes: string | null;
    }[];
  };

  const bySupplier = new Map<string, SplitPayload>();
  let grandTotal = 0;

  for (const line of data.items) {
    const subtotalLine = line.quantity * line.unitPrice;
    grandTotal += subtotalLine;

    let split = bySupplier.get(line.supplierId);
    if (!split) {
      split = {
        supplier_id:            line.supplierId,
        subtotal:               0,
        warehouse_id:           null,
        expected_delivery_date: data.deliveryDate ?? null,
        delivery_zone_id:       null,
        items:                  [],
      };
      bySupplier.set(line.supplierId, split);
    }
    split.subtotal += subtotalLine;
    split.items.push({
      product_id:    line.productId,
      sales_unit_id: line.salesUnitId ?? null,
      quantity:      line.quantity,
      unit_price:    line.unitPrice,
      notes:         line.notes ?? null,
    });
  }

  // 5. Best-effort: popola warehouse_id con il primary del supplier, se disponibile.
  // Non bloccante: se la query fallisce lasciamo null e la RPC procede.
  const supplierIds = [...bySupplier.keys()];
  try {
    const { data: warehouses } = await (supabase as any)
      .from("warehouses")
      .select("id, supplier_id, is_primary")
      .in("supplier_id", supplierIds) as {
        data: { id: string; supplier_id: string; is_primary: boolean | null }[] | null;
      };
    if (warehouses) {
      const primaryBySupplier = new Map<string, string>();
      // Preferisci is_primary=true; fallback al primo disponibile.
      for (const w of warehouses) {
        if (w.is_primary && !primaryBySupplier.has(w.supplier_id)) {
          primaryBySupplier.set(w.supplier_id, w.id);
        }
      }
      for (const w of warehouses) {
        if (!primaryBySupplier.has(w.supplier_id)) {
          primaryBySupplier.set(w.supplier_id, w.id);
        }
      }
      for (const [sid, split] of bySupplier) {
        const wid = primaryBySupplier.get(sid);
        if (wid) split.warehouse_id = wid;
      }
    }
  } catch {
    /* warehouse lookup non bloccante */
  }

  // 6. Costruisci payload RPC.
  const payload = {
    restaurant_id: data.restaurantId,
    notes:         data.notes ?? null,
    total:         Number(grandTotal.toFixed(2)),
    splits:        [...bySupplier.values()],
  };

  // 7. Chiama RPC atomica.
  const { data: rpcData, error: rpcError } = await (supabase as any)
    .rpc("create_order_with_splits", { p_payload: payload }) as {
      data: RpcOut | null;
      error: { message: string } | null;
    };

  if (rpcError || !rpcData) {
    return { ok: false, error: rpcError?.message ?? "Errore durante l'invio dell'ordine" };
  }

  const splitIds = (rpcData.splits ?? []).map((s) => ({
    supplierId: s.supplier_id,
    splitId:    s.split_id,
  }));

  // 8. TODO(plan-1c-task-?): dispatchEvent('order_received', supplierId, { splitId })
  // fire-and-forget una volta disponibile il notification dispatcher.

  revalidatePath("/dashboard");
  revalidatePath("/ordini");

  return {
    ok: true,
    data: { orderId: rpcData.order_id, splitIds },
  };
}
