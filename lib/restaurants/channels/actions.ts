/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

// Order to any supplier, any channel: contacts of off-platform suppliers,
// dispatch log (WhatsApp / email / PDF / phone) and supplier confirmation.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessCan, getRestaurantAccess, requireRestaurantContext } from "@/lib/restaurants/context";
import { buildCatalogBlockPdf, parseCatalogOrderBlocks } from "@/lib/orders/catalog-pdf";
import { sendEmail } from "@/lib/notifications/email";
import { normalizeWhatsAppPhone, type OrderChannel } from "./text";
import { catalogIdsByName, loadCatalogContacts } from "./server";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

const MISSING = "Funzione non ancora attiva: applica le migrazioni del database (restaurant superpowers).";
function friendly(err: { message?: string; code?: string } | null | undefined, fallback: string): string {
  if (!err) return fallback;
  if (err.code === "42P01" || /does not exist|schema cache/i.test(err.message ?? "")) return MISSING;
  if (err.code === "42501" || /row-level security/i.test(err.message ?? "")) return "Il tuo ruolo non consente questa operazione";
  return err.message || fallback;
}

/* ------------------------------------------------------------------ */
/* Contacts                                                             */
/* ------------------------------------------------------------------ */

const contactSchema = z.object({
  catalogId: z.string().uuid(),
  preferredChannel: z.enum(["whatsapp", "email", "pdf", "phone"]),
  contactName: z.string().trim().max(120).nullable(),
  whatsappPhone: z.string().trim().max(30).nullable(),
  email: z.string().trim().max(200).nullable(),
  notes: z.string().trim().max(300).nullable(),
});

export async function saveCatalogContact(input: z.infer<typeof contactSchema>): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  const auth = await requireRestaurantContext("order.submit");
  if (!auth.ok) return auth;
  const d = parsed.data;
  const supabase = (await createClient()) as any;
  const { data: cat } = await supabase
    .from("restaurant_catalogs")
    .select("id, restaurant_id")
    .eq("id", d.catalogId)
    .in("restaurant_id", auth.ctx.scopeIds)
    .maybeSingle();
  if (!cat) return { ok: false, error: "Fornitore non trovato" };

  const phone = d.whatsappPhone ? normalizeWhatsAppPhone(d.whatsappPhone) : null;
  if (d.whatsappPhone && !phone) return { ok: false, error: "Numero WhatsApp non valido (es. +39 333 1234567)" };
  const email = d.email ? d.email.toLowerCase() : null;
  if (email && !z.string().email().safeParse(email).success) return { ok: false, error: "Email non valida" };
  if (d.preferredChannel === "whatsapp" && !phone) return { ok: false, error: "Serve il numero WhatsApp" };
  if (d.preferredChannel === "email" && !email) return { ok: false, error: "Serve l'indirizzo email" };

  const { error } = await supabase.from("restaurant_catalog_contacts").upsert(
    {
      catalog_id: d.catalogId,
      restaurant_id: cat.restaurant_id,
      preferred_channel: d.preferredChannel,
      contact_name: d.contactName || null,
      whatsapp_phone: phone,
      email,
      notes: d.notes || null,
      updated_by: auth.ctx.userId,
    },
    { onConflict: "catalog_id" },
  );
  if (error) return { ok: false, error: friendly(error, "Errore salvataggio contatto") };
  revalidatePath("/consegne");
  revalidatePath("/ordini");
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* Dispatches                                                           */
/* ------------------------------------------------------------------ */

type AuthorizedBlock = {
  order: { id: string; restaurant_id: string; status: string; notes: string };
  userId: string;
  supplierLabel: string;
  catalogId: string | null;
};

async function authorizeBlock(orderId: string, blockIndex: number): Promise<Result<AuthorizedBlock>> {
  if (!z.string().uuid().safeParse(orderId).success || !Number.isInteger(blockIndex) || blockIndex < 0) {
    return { ok: false, error: "Ordine non valido" };
  }
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione scaduta, effettua di nuovo l'accesso" };
  const { data: order } = await supabase
    .from("orders")
    .select("id, restaurant_id, status, notes")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.notes) return { ok: false, error: "Ordine non trovato" };
  const access = await getRestaurantAccess(order.restaurant_id);
  if (!access) return { ok: false, error: "Ordine non trovato" };
  if (!accessCan(access, "order.submit")) return { ok: false, error: "Il tuo ruolo non consente di inviare ordini" };
  if (order.status === "cancelled") return { ok: false, error: "Ordine annullato" };
  const block = parseCatalogOrderBlocks(order.notes)[blockIndex];
  if (!block) return { ok: false, error: "Fornitore non trovato nell'ordine" };
  const byName = await catalogIdsByName(order.restaurant_id);
  return {
    ok: true,
    data: {
      order,
      userId: user.id,
      supplierLabel: block.supplierName,
      catalogId: byName.get(block.supplierName.trim().toLowerCase()) ?? null,
    },
  };
}

async function insertDispatch(
  a: AuthorizedBlock,
  blockIndex: number,
  channel: OrderChannel,
  recipient: string | null,
  emailMessageId: string | null = null,
): Promise<Result> {
  const supabase = (await createClient()) as any;
  const { error } = await supabase.from("order_dispatches").insert({
    order_id: a.order.id,
    restaurant_id: a.order.restaurant_id,
    block_index: blockIndex,
    catalog_id: a.catalogId,
    supplier_label: a.supplierLabel,
    channel,
    recipient,
    email_message_id: emailMessageId,
    sent_by: a.userId,
  });
  if (error) return { ok: false, error: friendly(error, "Errore registrazione invio") };
  revalidatePath(`/ordini/${a.order.id}`);
  revalidatePath("/ordini");
  return { ok: true, data: undefined };
}

/** Log a WhatsApp / PDF / phone send (the client opened wa.me or downloaded the PDF). */
export async function recordOrderDispatch(input: {
  orderId: string;
  blockIndex: number;
  channel: "whatsapp" | "pdf" | "phone";
}): Promise<Result> {
  if (!["whatsapp", "pdf", "phone"].includes(input.channel)) return { ok: false, error: "Canale non valido" };
  const auth = await authorizeBlock(input.orderId, input.blockIndex);
  if (!auth.ok) return auth;
  let recipient: string | null = null;
  if (auth.data.catalogId && input.channel === "whatsapp") {
    recipient = (await loadCatalogContacts([auth.data.catalogId])).get(auth.data.catalogId)?.whatsappPhone ?? null;
  }
  return insertDispatch(auth.data, input.blockIndex, input.channel, recipient);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Email the order PDF to the supplier (Resend), reply-to the restaurant. */
export async function sendOrderByEmail(input: { orderId: string; blockIndex: number; text: string }): Promise<Result> {
  const auth = await authorizeBlock(input.orderId, input.blockIndex);
  if (!auth.ok) return auth;
  const a = auth.data;
  if (!a.catalogId) return { ok: false, error: "Fornitore non trovato tra i tuoi listini" };
  const contact = (await loadCatalogContacts([a.catalogId])).get(a.catalogId);
  if (!contact?.email) return { ok: false, error: "Imposta prima l'email del fornitore" };

  const pdf = await buildCatalogBlockPdf(a.order.id, input.blockIndex);
  if ("error" in pdf) return { ok: false, error: pdf.error };

  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const replyTo = pdf.restaurant.email || user?.email || undefined;
  const restaurantName = pdf.restaurant.displayName.replace(/[<>"\r\n]/g, "").slice(0, 60) || "Ristorante";
  const text = input.text.slice(0, 4000);
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.55;color:#111">${escapeHtml(text)
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>")}<p style="color:#6b7280;font-size:12px;margin-top:20px">Ordine inviato con GastroBridge. Rispondi a questa email per confermare o segnalare variazioni.</p></div>`;

  const res = await sendEmail({
    to: contact.email,
    subject: `Ordine ${restaurantName} — ${pdf.filename.replace(/\.pdf$/, "")}`,
    html,
    text: text.replace(/\*/g, ""),
    from: `${restaurantName} via GastroBridge <ordini@gastrobridge.it>`,
    replyTo,
    attachments: [{ filename: pdf.filename, content: pdf.buffer }],
  });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error.includes("RESEND_API_KEY") ? "Invio email non configurato sul server (RESEND_API_KEY)" : res.error,
    };
  }
  return insertDispatch(a, input.blockIndex, "email", contact.email, res.id ?? null);
}

/** The supplier confirmed (by phone / WhatsApp / email): mark it, and the order when all are confirmed. */
export async function confirmOrderDispatch(input: { orderId: string; blockIndex: number }): Promise<Result> {
  const auth = await authorizeBlock(input.orderId, input.blockIndex);
  if (!auth.ok) return auth;
  const a = auth.data;
  const supabase = (await createClient()) as any;
  const now = new Date().toISOString();

  const { data: existing, error: selErr } = await supabase
    .from("order_dispatches")
    .select("id")
    .eq("order_id", a.order.id)
    .eq("block_index", input.blockIndex)
    .order("sent_at", { ascending: false })
    .limit(1);
  if (selErr) return { ok: false, error: friendly(selErr, "Errore conferma") };
  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("order_dispatches")
      .update({ status: "confirmed", confirmed_by: a.userId, confirmed_at: now })
      .eq("id", existing[0].id);
    if (error) return { ok: false, error: friendly(error, "Errore conferma") };
  } else {
    // Confirmed without a logged send (e.g. ordered by phone).
    const { error } = await supabase.from("order_dispatches").insert({
      order_id: a.order.id,
      restaurant_id: a.order.restaurant_id,
      block_index: input.blockIndex,
      catalog_id: a.catalogId,
      supplier_label: a.supplierLabel,
      channel: "phone",
      status: "confirmed",
      sent_by: a.userId,
      confirmed_by: a.userId,
      confirmed_at: now,
    });
    if (error) return { ok: false, error: friendly(error, "Errore conferma") };
  }

  // All supplier blocks confirmed → the header order is confirmed.
  const blocks = parseCatalogOrderBlocks(a.order.notes).length;
  const { data: confirmed } = await supabase
    .from("order_dispatches")
    .select("block_index")
    .eq("order_id", a.order.id)
    .eq("status", "confirmed");
  const done = new Set(((confirmed ?? []) as { block_index: number }[]).map((r) => r.block_index));
  if (done.size >= blocks && a.order.status === "submitted") {
    try {
      // Catalog orders have no supplier workflow; authorized above (order.submit).
      await (createAdminClient() as any).from("orders").update({ status: "confirmed" }).eq("id", a.order.id);
    } catch {
      /* best effort */
    }
  }
  revalidatePath(`/ordini/${a.order.id}`);
  revalidatePath("/ordini");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}
