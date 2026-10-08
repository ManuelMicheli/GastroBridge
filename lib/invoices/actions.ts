"use server";

// Server actions of Finanze → Fatture fornitori. Every action authorizes on
// the active restaurant (getFinanceAccess) and writes through the user client,
// so RLS (settings.manage) stays the authoritative gate.

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { sendMessage } from "@/lib/messages/actions";
import { recomputeFoodCost } from "@/lib/food-cost/server/engine";
import { normalizeVat } from "./fatturapa.ts";
import { getFinanceAccess } from "./server/access";
import { rows } from "./server/db";
import { ingestDocuments, refreshInvoiceStatus, reprocessInvoice, type IngestReport } from "./server/pipeline";
import { notifyAfterIngest } from "./server/notify";
import { companyDefaults, getConnection, registerRestaurant, syncConnection } from "./server/sdi";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

function revalidateFinance(id?: string) {
  revalidatePath("/finanze");
  revalidatePath("/finanze/fatture");
  if (id) revalidatePath(`/finanze/fatture/${id}`);
  revalidatePath("/finanze/ricette");
  revalidatePath("/finanze/collegamenti");
}

/* ------------------------------------------------------------------ */
/* Upload                                                               */
/* ------------------------------------------------------------------ */

const UploadSchema = z
  .array(
    z.object({
      fileName: z.string().min(1).max(300),
      xml: z.string().min(20).max(950_000),
      sourceKind: z.enum(["xml", "p7m", "p7m_base64"]),
    }),
  )
  .min(1)
  .max(40);

/**
 * Import FatturaPA documents already extracted in the browser (zip / p7m
 * unwrapped client-side so big archives fit the server action body limit).
 * The server re-parses and re-validates everything.
 */
export async function uploadInvoiceDocuments(input: unknown): Promise<Result<IngestReport>> {
  const parsed = UploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "File non validi o troppo grandi (max 40 per invio)" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  try {
    const report = await ingestDocuments(access.db, access.ctx.restaurantId, parsed.data, { source: "upload" });
    if (report.imported.length > 0) {
      const alerts = await recomputeFoodCost(access.db, access.ctx.restaurantId).catch(() => []);
      // The uploader sees the result on screen; the rest of the team is told
      // about high-severity anomalies, settled disputes and food cost jumps.
      await notifyAfterIngest(access.ctx.restaurantId, report, alerts, { excludeProfileIds: [access.ctx.userId] });
    }
    revalidateFinance();
    return { ok: true, data: report };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Importazione non riuscita" };
  }
}

/* ------------------------------------------------------------------ */
/* Findings, disputes, resolution                                       */
/* ------------------------------------------------------------------ */

async function statusContextFor(db: Parameters<typeof refreshInvoiceStatus>[0], invoiceId: string) {
  const { data } = await db
    .from("supplier_invoices")
    .select("supplier_name, document_number, document_type, supplier_id, catalog_id, matched_order_ids")
    .eq("id", invoiceId)
    .maybeSingle();
  const lines = await rows<{ agreed_unit_price: number | null }>(
    db.from("supplier_invoice_lines").select("agreed_unit_price").eq("invoice_id", invoiceId),
    "ctx lines",
  );
  return {
    isCreditNote: data?.document_type === "TD04" || data?.document_type === "TD08",
    supplierKnown: !!(data?.supplier_id || data?.catalog_id),
    matchedOrders: (data?.matched_order_ids ?? []).length,
    priceChecked: lines.some((l) => l.agreed_unit_price !== null),
    supplierName: data?.supplier_name ?? null,
    number: data?.document_number ?? "",
    documentType: data?.document_type ?? "TD01",
  };
}

export async function setFindingStatus(findingId: string, status: "open" | "dismissed"): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { data: f } = await access.db
    .from("supplier_invoice_findings")
    .select("id, invoice_id, status")
    .eq("id", findingId)
    .eq("restaurant_id", access.ctx.restaurantId)
    .maybeSingle();
  if (!f) return { ok: false, error: "Anomalia non trovata" };
  if (f.status !== "open" && f.status !== "dismissed") return { ok: false, error: "Anomalia già contestata o risolta" };
  const { error } = await access.db
    .from("supplier_invoice_findings")
    .update({ status, resolved_at: status === "dismissed" ? new Date().toISOString() : null, resolved_by: status === "dismissed" ? access.ctx.userId : null })
    .eq("id", findingId);
  if (error) return { ok: false, error: error.message };
  await refreshInvoiceStatus(access.db, f.invoice_id, await statusContextFor(access.db, f.invoice_id));
  revalidateFinance(f.invoice_id);
  return { ok: true, data: undefined };
}

const DisputeSchema = z.object({
  invoiceId: z.string().uuid(),
  findingIds: z.array(z.string().uuid()).min(1).max(100),
  message: z.string().min(10).max(4000),
  channel: z.enum(["chat", "email", "copy"]),
});

export async function createDispute(input: unknown): Promise<Result<{ sentInChat: boolean }>> {
  const parsed = DisputeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Contestazione non valida" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { db, ctx } = access;
  const { invoiceId, findingIds, message, channel } = parsed.data;

  const { data: inv } = await db
    .from("supplier_invoices")
    .select("id, relationship_id")
    .eq("id", invoiceId)
    .eq("restaurant_id", ctx.restaurantId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Fattura non trovata" };
  const findings = await rows<{ id: string; impact_cents: number; status: string }>(
    db.from("supplier_invoice_findings").select("id, impact_cents, status").eq("invoice_id", invoiceId).in("id", findingIds),
    "dispute findings",
  );
  const open = findings.filter((f) => f.status === "open");
  if (open.length === 0) return { ok: false, error: "Nessuna anomalia aperta selezionata" };
  const requested = open.reduce((s, f) => s + Number(f.impact_cents), 0);

  let sentInChat = false;
  if (channel === "chat") {
    if (!inv.relationship_id) return { ok: false, error: "Il fornitore non è collegato su GastroBridge: copia il testo o invialo via email" };
    const res = await sendMessage({ relationship_id: inv.relationship_id, body: message.slice(0, 2000) });
    if (!res.ok) return { ok: false, error: `Messaggio non inviato: ${res.error}` };
    sentInChat = true;
  }

  const { data: dispute, error } = await db
    .from("supplier_invoice_disputes")
    .insert({
      invoice_id: invoiceId,
      restaurant_id: ctx.restaurantId,
      message,
      channel,
      relationship_id: channel === "chat" ? inv.relationship_id : null,
      requested_cents: requested,
      finding_ids: open.map((f) => f.id),
    })
    .select("id")
    .single();
  if (error || !dispute) return { ok: false, error: error?.message ?? "Contestazione non salvata" };
  await db
    .from("supplier_invoice_findings")
    .update({ status: "disputed", dispute_id: dispute.id })
    .in("id", open.map((f) => f.id));
  await db.from("supplier_invoices").update({ disputed_at: new Date().toISOString(), resolved_at: null }).eq("id", invoiceId);
  await refreshInvoiceStatus(db, invoiceId, await statusContextFor(db, invoiceId));
  revalidateFinance(invoiceId);
  return { ok: true, data: { sentInChat } };
}

const ResolveSchema = z.object({
  invoiceId: z.string().uuid(),
  recoveredEuro: z.number().min(0).max(1_000_000),
  resolution: z.enum(["manual", "waived"]),
});

/** Close the disputes of an invoice by hand (credit note outside the SDI, refund, waiver). */
export async function resolveInvoice(input: unknown): Promise<Result> {
  const parsed = ResolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dati non validi" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { db, ctx } = access;
  const { invoiceId, recoveredEuro, resolution } = parsed.data;
  const { data: inv } = await db.from("supplier_invoices").select("id, recovered_cents").eq("id", invoiceId).eq("restaurant_id", ctx.restaurantId).maybeSingle();
  if (!inv) return { ok: false, error: "Fattura non trovata" };
  const now = new Date().toISOString();
  const open = await rows<{ id: string; requested_cents: number }>(
    db.from("supplier_invoice_disputes").select("id, requested_cents").eq("invoice_id", invoiceId).is("resolved_at", null),
    "open disputes",
  );
  let remaining = Math.round(recoveredEuro * 100);
  for (const d of open) {
    const share = Math.min(remaining, Number(d.requested_cents));
    remaining -= share;
    await db.from("supplier_invoice_disputes").update({ resolved_at: now, resolution, recovered_cents: share }).eq("id", d.id);
  }
  if (open.length === 0 && remaining > 0) {
    await db.from("supplier_invoices").update({ recovered_cents: Number(inv.recovered_cents) + remaining }).eq("id", invoiceId);
  }
  await db
    .from("supplier_invoice_findings")
    .update({ status: "resolved", resolved_at: now, resolved_by: ctx.userId })
    .eq("invoice_id", invoiceId)
    .in("status", ["open", "disputed"])
    .eq("recoverable", true);
  await db.from("supplier_invoices").update({ resolved_at: now, reviewed_at: now, reviewed_by: ctx.userId }).eq("id", invoiceId);
  await refreshInvoiceStatus(db, invoiceId, await statusContextFor(db, invoiceId));
  revalidateFinance(invoiceId);
  return { ok: true, data: undefined };
}

/** Reopen an invoice marked as resolved by mistake. */
export async function reopenInvoice(invoiceId: string): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { db, ctx } = access;
  const { error } = await db.from("supplier_invoices").update({ resolved_at: null }).eq("id", invoiceId).eq("restaurant_id", ctx.restaurantId);
  if (error) return { ok: false, error: error.message };
  await refreshInvoiceStatus(db, invoiceId, await statusContextFor(db, invoiceId));
  revalidateFinance(invoiceId);
  return { ok: true, data: undefined };
}

export async function setPaymentPaid(paymentId: string, paid: boolean): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { error } = await access.db
    .from("supplier_invoice_payments")
    .update({ paid_at: paid ? new Date().toISOString() : null, paid_by: paid ? access.ctx.userId : null })
    .eq("id", paymentId)
    .eq("restaurant_id", access.ctx.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data: undefined };
}

const LinkSchema = z.object({
  invoiceId: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
  catalogId: z.string().uuid().nullable(),
});

/** Link an unknown P.IVA to a supplier / catalog and re-run the checks. */
export async function linkInvoiceSupplier(input: unknown): Promise<Result> {
  const parsed = LinkSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.supplierId && !parsed.data.catalogId)) return { ok: false, error: "Scegli un fornitore o un catalogo" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { db, ctx } = access;
  const { data: inv } = await db.from("supplier_invoices").select("id, supplier_vat").eq("id", parsed.data.invoiceId).eq("restaurant_id", ctx.restaurantId).maybeSingle();
  if (!inv) return { ok: false, error: "Fattura non trovata" };
  const vat = normalizeVat(inv.supplier_vat);
  if (!vat) return { ok: false, error: "La fattura non ha la Partita IVA del fornitore" };
  const { error } = await db
    .from("invoice_supplier_links")
    .upsert(
      { restaurant_id: ctx.restaurantId, supplier_vat: vat, supplier_id: parsed.data.supplierId, catalog_id: parsed.data.catalogId, source: "user" },
      { onConflict: "restaurant_id,supplier_vat" },
    );
  if (error) return { ok: false, error: error.message };
  // Re-run every invoice of this supplier.
  const same = await rows<{ id: string }>(
    db.from("supplier_invoices").select("id").eq("restaurant_id", ctx.restaurantId).eq("supplier_vat", vat).limit(200),
    "same supplier",
  );
  for (const s of same) await reprocessInvoice(db, ctx.restaurantId, s.id);
  await recomputeFoodCost(db, ctx.restaurantId).catch(() => []);
  revalidateFinance(parsed.data.invoiceId);
  return { ok: true, data: undefined };
}

export async function reprocessInvoiceAction(invoiceId: string): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const res = await reprocessInvoice(access.db, access.ctx.restaurantId, invoiceId);
  if (!res) return { ok: false, error: "Fattura non trovata" };
  revalidateFinance(invoiceId);
  return { ok: true, data: undefined };
}

/** Delete an imported file (all its invoices). */
export async function deleteInvoice(invoiceId: string): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { data: inv } = await access.db
    .from("supplier_invoices")
    .select("file_id")
    .eq("id", invoiceId)
    .eq("restaurant_id", access.ctx.restaurantId)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Fattura non trovata" };
  const { error } = await access.db.from("supplier_invoice_files").delete().eq("id", inv.file_id).eq("restaurant_id", access.ctx.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidateFinance();
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* SDI connection (wizard)                                              */
/* ------------------------------------------------------------------ */

const ConnectSchema = z.object({
  fiscalId: z.string().min(11).max(16),
  companyName: z.string().min(2).max(300),
  email: z.string().email().max(200).nullable(),
});

export async function connectSdi(input: unknown): Promise<Result<{ recipientCode: string | null }>> {
  const parsed = ConnectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Controlla Partita IVA, ragione sociale ed email" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const res = await registerRestaurant(access.db, access.ctx.restaurantId, parsed.data);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/finanze");
  revalidatePath("/finanze/fatture");
  revalidatePath("/finanze/fatture/collega");
  return { ok: true, data: { recipientCode: res.connection.recipient_code } };
}

export async function confirmPortalRegistration(): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { error } = await access.db
    .from("sdi_connections")
    .update({ portal_confirmed_at: new Date().toISOString() })
    .eq("restaurant_id", access.ctx.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finanze/fatture/collega");
  revalidatePath("/finanze");
  return { ok: true, data: undefined };
}

export async function syncSdiNow(): Promise<Result<{ imported: number }>> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const conn = await getConnection(access.db, access.ctx.restaurantId);
  if (!conn) return { ok: false, error: "Ricezione automatica non collegata" };
  const res = await syncConnection(conn);
  revalidateFinance();
  if (res.error) return { ok: false, error: res.error };
  return { ok: true, data: { imported: res.imported } };
}

export async function getCompanyDefaultsAction(): Promise<Result<{ fiscalId: string | null; companyName: string | null; email: string | null }>> {
  const access = await getFinanceAccess("read");
  if (!access.ok) return { ok: false, error: access.error };
  return { ok: true, data: await companyDefaults(access.ctx.restaurantId) };
}
