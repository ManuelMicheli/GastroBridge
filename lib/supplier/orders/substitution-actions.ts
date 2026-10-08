/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Sends the substitution proposals chosen in the order detail to the client,
// as a message in the per-order chat thread (visible in the restaurant's
// order page and messages). The line itself has already been rejected with a
// reason naming the alternative via `acceptOrderLines`.
//
// Hook for the restaurant area: the message body is plain text; a one-tap
// "accetta alternativa" button on the restaurant side is deferred (see spec
// §4.3). Sales add the accepted alternative with the phone order form.

import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/messages/actions";
import { resolveRelationshipIdForPair } from "@/lib/messages/context";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { formatCurrency } from "@/lib/utils/formatters";

export type SubstitutionProposalInput = {
  lineId: string;
  substituteProductId: string;
};

export async function sendSubstitutionProposals(
  splitId: string,
  proposals: SubstitutionProposalInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!splitId || !Array.isArray(proposals) || proposals.length === 0) {
    return { ok: false, error: "Nessuna proposta" };
  }
  if (proposals.length > 50) return { ok: false, error: "Troppe proposte" };

  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "order.accept_line")) {
    return { ok: false, error: "Il tuo ruolo non può proporre sostituzioni" };
  }
  const supabase = await createClient();

  const { data: split } = (await (supabase as any)
    .from("order_splits")
    .select("id, supplier_id, orders:order_id ( restaurant_id )")
    .eq("id", splitId)
    .eq("supplier_id", member.supplier_id)
    .maybeSingle()) as { data: { id: string; supplier_id: string; orders: { restaurant_id: string } | null } | null };
  if (!split?.orders) return { ok: false, error: "Ordine non trovato" };

  const lineIds = proposals.map((p) => p.lineId);
  const { data: lines } = (await (supabase as any)
    .from("order_split_items")
    .select("id, quantity_requested, products:product_id ( name, unit )")
    .eq("order_split_id", splitId)
    .in("id", lineIds)) as {
    data: Array<{ id: string; quantity_requested: number; products: { name: string; unit: string } | null }> | null;
  };
  const subIds = [...new Set(proposals.map((p) => p.substituteProductId))];
  const { data: subs } = (await (supabase as any)
    .from("products")
    .select("id, name, unit, price")
    .eq("supplier_id", member.supplier_id)
    .in("id", subIds)) as { data: Array<{ id: string; name: string; unit: string; price: number }> | null };

  const lineMap = new Map((lines ?? []).map((l) => [l.id, l]));
  const subMap = new Map((subs ?? []).map((s) => [s.id, s]));
  const rows: string[] = [];
  for (const p of proposals) {
    const line = lineMap.get(p.lineId);
    const sub = subMap.get(p.substituteProductId);
    if (!line || !sub) continue;
    rows.push(
      `• ${line.products?.name ?? "Prodotto"} (${Number(line.quantity_requested)} ${line.products?.unit ?? ""}) → ${sub.name} a ${formatCurrency(Number(sub.price))}/${sub.unit}`,
    );
  }
  if (rows.length === 0) return { ok: false, error: "Proposte non valide" };

  const relationshipId = await resolveRelationshipIdForPair(split.orders.restaurant_id, member.supplier_id);
  if (!relationshipId) return { ok: false, error: "Nessuna relazione attiva con il cliente" };

  const body = [
    `Alcuni prodotti del tuo ordine #${splitId.slice(0, 8)} non sono disponibili. Ti proponiamo in alternativa:`,
    ...rows,
    "Rispondi qui (o chiamaci) per confermare: aggiungiamo noi l'alternativa all'ordine.",
  ].join("\n");

  const res = await sendMessage({ relationship_id: relationshipId, order_split_id: splitId, body: body.slice(0, 2000) });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}
