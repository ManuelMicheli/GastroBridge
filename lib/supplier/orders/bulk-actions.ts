/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Bulk order intake: accept every pending line of several splits in one go.
// Each split goes through the regular `acceptOrderLines` (permission check
// `order.accept_line`, FEFO stock reservation, events, notifications), so the
// result is identical to accepting the orders one by one.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { acceptOrderLines } from "@/lib/orders/supplier-actions";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";

export type BulkAcceptOutcome = {
  splitId: string;
  result: "confirmed" | "stock_conflict" | "error";
  message?: string;
};

export async function bulkAcceptSplits(
  splitIds: string[],
): Promise<{ ok: true; data: BulkAcceptOutcome[] } | { ok: false; error: string }> {
  const ids = [...new Set((splitIds ?? []).filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return { ok: false, error: "Nessun ordine selezionato" };
  if (ids.length > 50) return { ok: false, error: "Massimo 50 ordini per volta" };

  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "order.accept_line")) {
    return { ok: false, error: "Il tuo ruolo non può accettare ordini" };
  }

  const supabase = await createClient();
  const { data: lines, error } = (await (supabase as any)
    .from("order_split_items")
    .select("id, order_split_id, status, order_splits!inner(supplier_id)")
    .in("order_split_id", ids)
    .eq("order_splits.supplier_id", member.supplier_id)) as {
    data: Array<{ id: string; order_split_id: string; status: string }> | null;
    error: { message: string } | null;
  };
  if (error) return { ok: false, error: error.message };

  const pendingBySplit = new Map<string, string[]>();
  for (const l of lines ?? []) {
    if (l.status !== "pending") continue;
    const arr = pendingBySplit.get(l.order_split_id) ?? [];
    arr.push(l.id);
    pendingBySplit.set(l.order_split_id, arr);
  }

  const outcomes: BulkAcceptOutcome[] = [];
  // Sequential on purpose: reservations consume the same lots (FEFO).
  for (const splitId of ids) {
    const pending = pendingBySplit.get(splitId) ?? [];
    if (pending.length === 0) {
      outcomes.push({ splitId, result: "error", message: "Nessuna riga in attesa" });
      continue;
    }
    const res = await acceptOrderLines({
      splitId,
      decisions: pending.map((lineId) => ({ lineId, action: "accept" as const })),
    });
    if (!res.ok) {
      outcomes.push({ splitId, result: "error", message: res.error });
    } else if (res.data.splitStatus === "stock_conflict") {
      outcomes.push({ splitId, result: "stock_conflict", message: "Stock insufficiente" });
    } else {
      outcomes.push({ splitId, result: "confirmed" });
    }
  }

  revalidatePath("/supplier/oggi");
  revalidatePath("/supplier/ordini");
  return { ok: true, data: outcomes };
}
