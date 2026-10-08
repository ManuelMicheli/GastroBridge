/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Ordine telefonico / WhatsApp: a sales rep keys an order on behalf of a
// connected restaurant.
//
// Authorisation (all server-side, before any write):
//   * caller is an active supplier member with `order.accept_line`;
//   * the restaurant has an ACTIVE relationship with this supplier;
//   * every product belongs to the supplier and is available;
//   * prices are re-resolved here (client listino → base listino → catalog),
//     never taken from the browser.
// The order is then created through the same `create_order_with_splits` RPC
// used by restaurants (service role, since the RPC is SECURITY INVOKER and
// the restaurant-side INSERT policies only match the restaurant), with an
// audit event naming the member. Optionally all lines are accepted right
// away through the regular `acceptOrderLines` (stock reservation, events).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { acceptOrderLines } from "@/lib/orders/supplier-actions";
import { notifyRestaurants } from "@/lib/supplier/notify-restaurant";
import { formatCurrency } from "@/lib/utils/formatters";
import { resolveClientPrices } from "./queries";

const PhoneOrderSchema = z.object({
  relationshipId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive().max(100_000),
        notes: z.string().trim().max(300).optional().nullable(),
      }),
    )
    .min(1, "Aggiungi almeno un prodotto")
    .max(200),
  deliveryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  deliveryZoneId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  channel: z.enum(["telefono", "whatsapp", "visita", "email"]).default("telefono"),
  confirmNow: z.boolean().default(false),
});

export type PhoneOrderInput = z.input<typeof PhoneOrderSchema>;

export type PhoneOrderResult =
  | { ok: true; data: { splitId: string; confirmed: boolean; warning?: string } }
  | { ok: false; error: string };

const CHANNEL_LABEL: Record<string, string> = {
  telefono: "telefono",
  whatsapp: "WhatsApp",
  visita: "visita dell'agente",
  email: "email",
};

export async function createPhoneOrder(input: PhoneOrderInput): Promise<PhoneOrderResult> {
  const parsed = PhoneOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati ordine non validi" };
  const data = parsed.data;

  const member = await getCurrentSupplierMember();
  if (!member || !memberCan(member, "order.accept_line")) {
    return { ok: false, error: "Il tuo ruolo non può inserire ordini per i clienti" };
  }
  const supplierId = member.supplier_id;
  const supabase = await createClient();

  const { data: rel } = (await (supabase as any)
    .from("restaurant_suppliers")
    .select("id, status, restaurant_id")
    .eq("id", data.relationshipId)
    .eq("supplier_id", supplierId)
    .maybeSingle()) as { data: { id: string; status: string; restaurant_id: string } | null };
  if (!rel) return { ok: false, error: "Cliente non trovato" };
  if (rel.status !== "active") return { ok: false, error: "La relazione con il cliente non è attiva" };

  // Merge duplicate products (same product twice in the form → one line).
  const merged = new Map<string, { quantity: number; notes: string | null }>();
  for (const l of data.lines) {
    const e = merged.get(l.productId);
    merged.set(l.productId, {
      quantity: (e?.quantity ?? 0) + l.quantity,
      notes: [e?.notes, l.notes].filter(Boolean).join(" · ") || null,
    });
  }
  const productIds = [...merged.keys()];
  const { data: prods } = (await (supabase as any)
    .from("products")
    .select("id, price, is_available")
    .eq("supplier_id", supplierId)
    .in("id", productIds)) as { data: Array<{ id: string; price: number; is_available: boolean }> | null };
  const valid = (prods ?? []).filter((p) => p.is_available);
  if (valid.length !== productIds.length) {
    return { ok: false, error: "Alcuni prodotti non sono più disponibili a catalogo" };
  }

  if (data.deliveryZoneId) {
    const { data: z0 } = await (supabase as any)
      .from("delivery_zones")
      .select("id")
      .eq("id", data.deliveryZoneId)
      .eq("supplier_id", supplierId)
      .maybeSingle();
    if (!z0) return { ok: false, error: "Zona di consegna non valida" };
  }

  const prices = await resolveClientPrices(supabase, supplierId, rel.restaurant_id, valid);
  const items = productIds.map((pid) => {
    const m = merged.get(pid)!;
    const pr = prices.get(pid)!;
    return {
      product_id: pid,
      sales_unit_id: pr.salesUnitId,
      quantity: Math.round(m.quantity * 1000) / 1000,
      unit_price: pr.price,
      notes: m.notes,
    };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.quantity * i.unit_price, 0) * 100) / 100;

  // Primary warehouse (same best-effort rule as the restaurant checkout).
  const { data: whs } = (await (supabase as any)
    .from("warehouses")
    .select("id, is_primary")
    .eq("supplier_id", supplierId)) as { data: Array<{ id: string; is_primary: boolean }> | null };
  const warehouseId = (whs ?? []).find((w) => w.is_primary)?.id ?? (whs ?? [])[0]?.id ?? null;

  const channel = CHANNEL_LABEL[data.channel] ?? data.channel;
  const orderNotes = [`Ordine preso via ${channel} dal fornitore`, data.notes?.trim() || null].filter(Boolean).join(" — ");

  const admin = createAdminClient() as any;
  const { data: rpc, error: rpcErr } = (await admin.rpc("create_order_with_splits", {
    p_payload: {
      restaurant_id: rel.restaurant_id,
      notes: orderNotes,
      total: subtotal,
      splits: [
        {
          supplier_id: supplierId,
          subtotal,
          warehouse_id: warehouseId,
          expected_delivery_date: data.deliveryDate,
          delivery_zone_id: data.deliveryZoneId ?? null,
          items,
        },
      ],
    },
  })) as { data: { order_id: string; splits: Array<{ split_id: string }> } | null; error: { message: string } | null };
  if (rpcErr || !rpc) return { ok: false, error: rpcErr?.message ?? "Errore creazione ordine" };
  const splitId = rpc.splits?.[0]?.split_id;
  if (!splitId) return { ok: false, error: "Ordine creato senza righe fornitore" };

  // Audit trail: who keyed the order and how.
  // (the RPC already wrote the `received` event: enrich it instead of adding one)
  await admin
    .from("order_split_events")
    .update({
      member_id: member.id,
      note: `Inserito dal fornitore (${channel})`,
      metadata: { source: "supplier_phone_entry", channel: data.channel, member_id: member.id },
    })
    .eq("order_split_id", splitId)
    .eq("event_type", "received");
  await admin.from("order_splits").update({ assigned_sales_member_id: member.id }).eq("id", splitId);

  let confirmed = false;
  let warning: string | undefined;
  if (data.confirmNow) {
    const { data: lines } = (await (supabase as any)
      .from("order_split_items")
      .select("id")
      .eq("order_split_id", splitId)) as { data: Array<{ id: string }> | null };
    const res = await acceptOrderLines({
      splitId,
      decisions: (lines ?? []).map((l) => ({ lineId: l.id, action: "accept" as const })),
    });
    if (!res.ok) warning = `Ordine creato ma non confermato: ${res.error}`;
    else if (res.data.splitStatus === "stock_conflict") warning = "Ordine creato: stock insufficiente, rivedi le righe";
    else confirmed = res.data.splitStatus === "confirmed";
  }

  const { data: sup } = (await (supabase as any)
    .from("suppliers")
    .select("company_name")
    .eq("id", supplierId)
    .maybeSingle()) as { data: { company_name: string } | null };
  await notifyRestaurants([rel.restaurant_id], {
    eventType: "order_created_by_supplier",
    fallbackEventType: "order_accepted",
    title: `${sup?.company_name ?? "Il fornitore"} ha registrato il tuo ordine`,
    body: `Ordine via ${channel}: ${items.length} prodotti, ${formatCurrency(subtotal)}${
      data.deliveryDate ? `, consegna prevista ${data.deliveryDate.split("-").reverse().join("/")}` : ""
    }.`,
    link: `/ordini/${splitId}`,
    metadata: { splitId, source: "supplier_phone_entry" },
  });

  revalidatePath("/supplier/ordini");
  revalidatePath("/supplier/oggi");
  return { ok: true, data: { splitId, confirmed, warning } };
}
