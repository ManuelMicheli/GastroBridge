/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Conta gli `order_splits` in stato raw `submitted` per il supplier dato.
 * Include tutti i workflow-state "attesa azione" (submitted, stock_conflict,
 * pending_customer_confirmation) perche' condividono lo stesso raw status.
 *
 * Usato per il badge "Ordini" nella sidebar. Torna 0 in caso di errore / se il
 * chiamante non ha il permesso `order.read` (RLS ritorna zero righe).
 */
export async function getPendingOrdersCount(
  supplierId: string,
): Promise<number> {
  try {
    const supabase = await createClient();
    const { data } = await (supabase.rpc as any)("has_supplier_permission", {
      p_supplier_id: supplierId,
      p_permission: "order.read",
    });
    if (!data) return 0;

    const { count } = await supabase
      .from("order_splits")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", supplierId)
      .eq("status", "submitted");
    return count ?? 0;
  } catch {
    return 0;
  }
}
