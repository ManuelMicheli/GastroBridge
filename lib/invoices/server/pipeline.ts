// lib/invoices/server/pipeline.ts
// Ingestion pipeline: XML documents → stored file → parsed invoices →
// reconciliation (orders / DDT / receiving / listino) → lines, findings,
// payment due dates, purchase price history → credit-note auto-match →
// status. Shared by manual upload (user client, RLS enforced), the SDI
// webhook and the safety-net sync (service role).

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "../decode.ts";
import type { ExtractedDocument } from "../archive.ts";
import { matchCreditNote, type DisputeCandidate } from "../credit-notes.ts";
import { CREDIT_NOTE_TYPES, normalizeVat, parseFatturaElement, parseFatturaPA, stripAttachments } from "../fatturapa.ts";
import { reconcileInvoice, type LineMatch, type ReconcileResult } from "../match.ts";
import { deriveStatus } from "../status.ts";
import { normalizeText } from "../text.ts";
import type { Finding, ParsedInvoice } from "../types.ts";
import { basePrices } from "../units.ts";
import { jsonToElement } from "../xml.ts";
import { addDaysIso, rows, toCents, type Db } from "./db";
import { candidatesFor, loadReferenceData, resolveSupplier, type ReferenceData } from "./reference";

export interface IngestSource {
  source: "upload" | "sdi" | "provider_sync";
  provider?: string | null;
  externalId?: string | null;
}

export interface IngestedInvoice {
  id: string;
  supplierName: string | null;
  number: string;
  documentType: string;
  status: string;
  findings: number;
  openCents: number;
  highSeverity: number;
  /** Credit note that settled (part of) a disputed invoice. */
  settled?: { invoiceId: string; invoiceNumber: string; recoveredCents: number } | null;
}

export interface IngestReport {
  imported: IngestedInvoice[];
  alreadyImported: string[];
  errors: Array<{ fileName: string; reason: string }>;
}

export interface IngestDocument {
  fileName: string;
  xml?: string;
  json?: unknown;
  sourceKind: ExtractedDocument["sourceKind"] | "json";
}

/** Parse documents first, then load reference data once for the batch. */
export async function ingestDocuments(
  db: Db,
  restaurantId: string,
  documents: IngestDocument[],
  src: IngestSource,
): Promise<IngestReport> {
  const report: IngestReport = { imported: [], alreadyImported: [], errors: [] };
  type Prepared = { doc: IngestDocument; xml: string; sha: string; invoices: ParsedInvoice[] };
  const prepared: Prepared[] = [];

  for (const doc of documents) {
    let invoices: ParsedInvoice[] = [];
    let xml = doc.xml ?? "";
    let errors: string[] = [];
    if (doc.xml) {
      ({ invoices, errors } = parseFatturaPA(doc.xml));
    } else if (doc.json !== undefined) {
      ({ invoices, errors } = parseFatturaElement(jsonToElement("FatturaElettronica", doc.json)));
      xml = JSON.stringify(doc.json);
    }
    if (invoices.length === 0) {
      report.errors.push({ fileName: doc.fileName, reason: errors[0] ?? "Nessuna fattura nel documento" });
      continue;
    }
    // Hash the stored form (attachments stripped): the same invoice uploaded
    // by hand (stripped in the browser) or received from the SDI dedupes.
    prepared.push({ doc, xml, sha: await sha256Hex(stripAttachments(xml)), invoices });
  }
  if (prepared.length === 0) return report;

  const dates = prepared.flatMap((p) => p.invoices.map((i) => i.date)).filter((d): d is string => !!d).sort();
  const today = new Date().toISOString().slice(0, 10);
  const from = addDaysIso(dates[0] ?? today, -75);
  const to = addDaysIso(dates[dates.length - 1] ?? today, 10);
  const ref = await loadReferenceData(restaurantId, { from, to });

  for (const p of prepared) {
    const stored = stripAttachments(p.xml);
    const { data: file, error: fileErr } = await db
      .from("supplier_invoice_files")
      .insert({
        restaurant_id: restaurantId,
        file_name: p.doc.fileName.slice(0, 300),
        source: src.source,
        provider: src.provider ?? null,
        external_id: src.externalId ?? null,
        source_kind: p.doc.sourceKind,
        sha256: p.sha,
        xml: stored,
        size_bytes: stored.length,
      })
      .select("id")
      .single();
    if (fileErr || !file) {
      if (fileErr?.code === "23505") report.alreadyImported.push(p.doc.fileName);
      else report.errors.push({ fileName: p.doc.fileName, reason: fileErr?.message ?? "Salvataggio non riuscito" });
      continue;
    }
    for (const inv of p.invoices) {
      try {
        const res = await persistInvoice(db, restaurantId, file.id as string, inv, ref, src);
        report.imported.push(res);
        ref.existing.push({
          id: res.id,
          supplierVat: normalizeVat(inv.supplier.vatNumber),
          documentType: inv.documentType,
          number: inv.number,
          date: inv.date,
          gross: inv.totals.gross,
        });
      } catch (err) {
        report.errors.push({ fileName: p.doc.fileName, reason: err instanceof Error ? err.message : "Errore di elaborazione" });
      }
    }
  }
  return report;
}

function ddtForLine(inv: ParsedInvoice, lineNumber: number): { number: string; date: string | null } | null {
  const hit = inv.ddt.find((d) => d.lineNumbers.includes(lineNumber));
  if (hit) return { number: hit.number, date: hit.date };
  const general = inv.ddt.filter((d) => d.lineNumbers.length === 0);
  return general.length === 1 ? { number: general[0]!.number, date: general[0]!.date } : null;
}

function parsedSummary(inv: ParsedInvoice) {
  return {
    formatVersion: inv.formatVersion,
    simplified: inv.simplified,
    transmission: inv.transmission,
    supplier: inv.supplier,
    buyer: inv.buyer,
    causale: inv.causale,
    ddt: inv.ddt,
    orderRefs: inv.orderRefs,
    linkedInvoices: inv.linkedInvoices,
    vatSummaries: inv.vatSummaries,
    stampDuty: inv.stampDuty,
    rounding: inv.rounding,
    totalDeclared: inv.totalAmount,
    globalDiscounts: inv.globalDiscounts,
    attachments: inv.attachments,
    warnings: inv.warnings,
  };
}

async function persistInvoice(
  db: Db,
  restaurantId: string,
  fileId: string,
  inv: ParsedInvoice,
  ref: ReferenceData,
  src: IngestSource,
): Promise<IngestedInvoice> {
  const vat = normalizeVat(inv.supplier.vatNumber);
  const supplier = resolveSupplier(vat, inv.supplier.name, ref);
  if (supplier.autoLink) {
    await db
      .from("invoice_supplier_links")
      .upsert(
        { restaurant_id: restaurantId, supplier_vat: supplier.autoLink.vat, supplier_id: supplier.autoLink.supplierId, catalog_id: supplier.autoLink.catalogId, source: "auto" },
        { onConflict: "restaurant_id,supplier_vat", ignoreDuplicates: true },
      );
    ref.links.set(supplier.autoLink.vat, { supplierId: supplier.autoLink.supplierId, catalogId: supplier.autoLink.catalogId, source: "auto" });
  }

  const { data: row, error } = await db
    .from("supplier_invoices")
    .insert({
      restaurant_id: restaurantId,
      file_id: fileId,
      body_index: inv.bodyIndex,
      supplier_vat: vat,
      supplier_tax_code: inv.supplier.taxCode,
      supplier_name: inv.supplier.name?.slice(0, 300) ?? null,
      supplier_id: supplier.supplierId,
      catalog_id: supplier.catalogId,
      relationship_id: supplier.relationshipId,
      buyer_vat: normalizeVat(inv.buyer.vatNumber) ?? inv.buyer.taxCode,
      buyer_name: inv.buyer.name?.slice(0, 300) ?? null,
      document_type: inv.documentType.slice(0, 8),
      document_number: (inv.number || "s.n.").slice(0, 60),
      document_date: inv.date,
      currency: inv.currency.slice(0, 3),
      taxable_amount: inv.totals.taxable,
      vat_amount: inv.totals.vat,
      total_amount: inv.totals.gross,
      parsed: parsedSummary(inv),
      sdi_identifier: src.externalId ?? null,
      received_via: src.source,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "Fattura non salvata");
  const invoiceId = row.id as string;

  return reconcileAndStore(db, restaurantId, invoiceId, inv, supplier, ref);
}

/**
 * (Re)compute the reconciliation of one stored invoice and write lines,
 * findings, payments and price history. Previous derived rows are replaced;
 * disputes and their findings history are kept.
 */
export async function reconcileAndStore(
  db: Db,
  restaurantId: string,
  invoiceId: string,
  inv: ParsedInvoice,
  supplier: ReturnType<typeof resolveSupplier>,
  ref: ReferenceData,
): Promise<IngestedInvoice> {
  const vat = normalizeVat(inv.supplier.vatNumber);
  const { orders, priceList } = candidatesFor(supplier, ref);
  const result: ReconcileResult = reconcileInvoice({
    invoice: inv,
    supplierKnown: supplier.known,
    orders,
    priceList,
    existing: ref.existing.filter((e) => e.id !== invoiceId),
    alreadyInvoiced: ref.alreadyInvoiced,
    receivingAvailable: ref.receivingAvailable,
    fallbackKeyPrefix: `i:${vat ?? normalizeText(inv.supplier.name ?? "fornitore").slice(0, 40)}`,
  });

  // Replace derived rows (idempotent re-run).
  await db.from("purchase_price_history").delete().eq("invoice_id", invoiceId);
  await db.from("supplier_invoice_findings").delete().eq("invoice_id", invoiceId).eq("status", "open");
  await db.from("supplier_invoice_lines").delete().eq("invoice_id", invoiceId);
  await db.from("supplier_invoice_payments").delete().eq("invoice_id", invoiceId).is("paid_at", null);

  const matchByLine = new Map<number, LineMatch>(result.lines.map((l) => [l.lineNumber, l]));
  const lineRows = inv.lines.map((l) => {
    const m = matchByLine.get(l.lineNumber);
    const ddt = ddtForLine(inv, l.lineNumber);
    return {
      invoice_id: invoiceId,
      restaurant_id: restaurantId,
      line_number: l.lineNumber,
      kind: l.kind,
      description: l.description.slice(0, 1000),
      item_codes: l.itemCodes,
      quantity: l.quantity,
      unit: l.unit?.slice(0, 20) ?? null,
      unit_price: l.unitPrice,
      total_price: l.totalPrice,
      vat_rate: l.vatRate,
      natura: l.natura,
      discounts: l.discounts,
      ddt_number: ddt?.number.slice(0, 60) ?? null,
      ddt_date: ddt?.date ?? null,
      order_id: m?.orderId ?? null,
      order_line_ref: m?.orderLineRef ?? null,
      product_id: m?.productId ?? null,
      price_key: m?.priceKey ?? null,
      match_score: m?.score ?? null,
      agreed_unit_price: m?.agreedUnitPrice ?? null,
      agreed_source: m?.agreedSource ?? null,
      effective_unit_price: m?.effectiveUnitPrice ?? null,
      ordered_qty: m?.orderedQty ?? null,
      received_qty: m?.receivedQty ?? null,
      quantity_source: m?.quantitySource ?? null,
      dimension: m?.dimension ?? null,
      note: m?.note ?? null,
    };
  });
  const insertedLines =
    lineRows.length > 0
      ? await rows<{ id: string; line_number: number }>(db.from("supplier_invoice_lines").insert(lineRows).select("id, line_number"), "insert lines")
      : [];
  const lineIdByNumber = new Map(insertedLines.map((l) => [l.line_number, l.id]));
  for (const m of result.lines) if (m.orderLineRef) ref.alreadyInvoiced.add(m.orderLineRef);

  // Findings that already went through a dispute stay as they are.
  const kept = await rows<{ kind: string; line_number: number | null; status: string; impact_cents: number; recoverable: boolean; severity: string }>(
    db.from("supplier_invoice_findings").select("kind, line_number, status, impact_cents, recoverable, severity").eq("invoice_id", invoiceId),
    "kept findings",
  );
  const keptKeys = new Set(kept.map((k) => `${k.kind}|${k.line_number ?? ""}`));
  const fresh: Finding[] = result.findings.filter((f) => !keptKeys.has(`${f.kind}|${f.lineNumber ?? ""}`));
  if (fresh.length > 0) {
    await db.from("supplier_invoice_findings").insert(
      fresh.map((f) => ({
        invoice_id: invoiceId,
        restaurant_id: restaurantId,
        line_number: f.lineNumber,
        kind: f.kind,
        severity: f.severity,
        impact_cents: f.impactCents,
        recoverable: f.recoverable,
        title: f.title.slice(0, 300),
        message: f.message.slice(0, 1000),
        details: f.details,
      })),
    );
  }

  // Payment due dates (skip installments already marked paid).
  const paid = await rows<{ installment: number }>(
    db.from("supplier_invoice_payments").select("installment").eq("invoice_id", invoiceId),
    "paid installments",
  );
  const paidSet = new Set(paid.map((p) => p.installment));
  const isCredit = CREDIT_NOTE_TYPES.has(inv.documentType);
  const payRows = isCredit
    ? []
    : inv.payments
        .map((p, i) => ({
          invoice_id: invoiceId,
          restaurant_id: restaurantId,
          installment: i + 1,
          due_date: p.dueDate,
          amount: p.amount ?? (inv.payments.length === 1 ? inv.totals.gross : null),
          method: p.method?.slice(0, 10) ?? null,
          iban: p.iban?.slice(0, 40) ?? null,
        }))
        .filter((p) => !paidSet.has(p.installment));
  if (payRows.length > 0) await db.from("supplier_invoice_payments").insert(payRows);

  // Purchase price history (goods lines with a real unit price).
  if (!isCredit) {
    const history = inv.lines
      .filter((l) => l.kind === "goods" && (l.quantity ?? 0) > 0 && l.totalPrice > 0)
      .map((l) => {
        const m = matchByLine.get(l.lineNumber);
        const unitPrice = m?.effectiveUnitPrice ?? l.totalPrice / (l.quantity ?? 1);
        const bases = basePrices(unitPrice, l.unit, l.description);
        const key = m?.priceKey ?? `i:${vat ?? "x"}:${normalizeText(l.description).slice(0, 80)}`;
        const catalogId = key.startsWith("c:") ? key.split(":")[1] ?? null : null;
        return {
          restaurant_id: restaurantId,
          price_key: key.slice(0, 300),
          product_id: m?.productId ?? null,
          catalog_id: catalogId,
          supplier_vat: vat,
          supplier_id: supplier.supplierId,
          supplier_name: inv.supplier.name,
          description: l.description.slice(0, 1000),
          unit: l.unit?.slice(0, 20) ?? null,
          quantity: l.quantity,
          unit_price: Math.round(unitPrice * 1e6) / 1e6,
          price_kg: bases.kg !== undefined ? Math.round(bases.kg * 1e6) / 1e6 : null,
          price_l: bases.l !== undefined ? Math.round(bases.l * 1e6) / 1e6 : null,
          price_pz: bases.pz !== undefined ? Math.round(bases.pz * 1e6) / 1e6 : null,
          invoice_id: invoiceId,
          invoice_line_id: lineIdByNumber.get(l.lineNumber) ?? null,
          document_date: inv.date,
        };
      });
    if (history.length > 0) await db.from("purchase_price_history").insert(history);
  }

  // Credit note → disputed / referenced invoice.
  const settled = isCredit ? await settleWithCreditNote(db, restaurantId, invoiceId, inv) : null;

  const out = await refreshInvoiceStatus(db, invoiceId, {
    isCreditNote: isCredit,
    supplierKnown: supplier.known,
    matchedOrders: result.orderIds.length,
    priceChecked: result.lines.some((l) => l.agreedUnitPrice !== null),
    method: result.method,
    confidence: result.confidence,
    orderIds: result.orderIds,
    supplierName: inv.supplier.name,
    number: inv.number,
    documentType: inv.documentType,
  });
  return { ...out, settled };
}

interface StatusContext {
  isCreditNote: boolean;
  supplierKnown: boolean;
  matchedOrders: number;
  priceChecked: boolean;
  method?: string;
  confidence?: number;
  orderIds?: string[];
  supplierName: string | null;
  number: string;
  documentType: string;
}

/** Recompute € totals + status of an invoice from its findings / disputes. */
export async function refreshInvoiceStatus(db: Db, invoiceId: string, c: StatusContext): Promise<IngestedInvoice> {
  const [findings, disputes, inv] = await Promise.all([
    rows<{ severity: "low" | "medium" | "high"; recoverable: boolean; impact_cents: number; status: "open" | "disputed" | "resolved" | "dismissed"; kind: Finding["kind"] }>(
      db.from("supplier_invoice_findings").select("severity, recoverable, impact_cents, status, kind").eq("invoice_id", invoiceId),
      "status findings",
    ),
    rows<{ requested_cents: number; recovered_cents: number; resolved_at: string | null }>(
      db.from("supplier_invoice_disputes").select("requested_cents, recovered_cents, resolved_at").eq("invoice_id", invoiceId),
      "status disputes",
    ),
    db.from("supplier_invoices").select("resolved_at, recovered_cents").eq("id", invoiceId).maybeSingle(),
  ]);
  const disputedOpen = disputes.some((d) => !d.resolved_at);
  const resolved = !!inv.data?.resolved_at && !disputedOpen;
  const status = deriveStatus({
    isCreditNote: c.isCreditNote,
    supplierKnown: c.supplierKnown,
    matchedOrders: c.matchedOrders,
    priceChecked: c.priceChecked,
    findings: findings.map((f) => ({ severity: f.severity, recoverable: f.recoverable, impactCents: Number(f.impact_cents), status: f.status, kind: f.kind })),
    disputed: disputedOpen,
    resolved,
  });
  const recoverable = findings.filter((f) => f.recoverable);
  const foundCents = recoverable.filter((f) => f.status !== "dismissed").reduce((s, f) => s + Number(f.impact_cents), 0);
  const openCents = recoverable.filter((f) => f.status === "open").reduce((s, f) => s + Number(f.impact_cents), 0);
  const disputedCents = disputes.filter((d) => !d.resolved_at).reduce((s, d) => s + Number(d.requested_cents), 0);
  const recoveredCents = Math.max(
    disputes.reduce((s, d) => s + Number(d.recovered_cents), 0),
    Number(inv.data?.recovered_cents ?? 0),
  );
  const patch: Record<string, unknown> = {
    status,
    found_cents: foundCents,
    open_cents: openCents,
    disputed_cents: disputedCents,
    recovered_cents: recoveredCents,
    findings_count: findings.filter((f) => f.status === "open").length,
  };
  if (c.method !== undefined) {
    patch.match_method = c.method;
    patch.match_confidence = c.confidence ?? null;
    patch.matched_order_ids = c.orderIds ?? [];
  }
  await db.from("supplier_invoices").update(patch).eq("id", invoiceId);
  return {
    id: invoiceId,
    supplierName: c.supplierName,
    number: c.number,
    documentType: c.documentType,
    status,
    findings: findings.filter((f) => f.status === "open" && (f.recoverable || f.severity !== "low")).length,
    openCents,
    highSeverity: findings.filter((f) => f.status === "open" && f.severity === "high").length,
  };
}

/** Auto-match a credit note to an open dispute (or the referenced invoice). */
async function settleWithCreditNote(
  db: Db,
  restaurantId: string,
  creditNoteId: string,
  note: ParsedInvoice,
): Promise<IngestedInvoice["settled"]> {
  const vat = normalizeVat(note.supplier.vatNumber);
  const disputes = await rows<{
    id: string;
    invoice_id: string;
    requested_cents: number;
    created_at: string;
    invoice: { document_number: string; document_date: string | null; supplier_vat: string | null } | null;
  }>(
    db
      .from("supplier_invoice_disputes")
      .select("id, invoice_id, requested_cents, created_at, invoice:supplier_invoices!invoice_id (document_number, document_date, supplier_vat)")
      .eq("restaurant_id", restaurantId)
      .is("resolved_at", null),
    "open disputes",
  );
  const candidates: DisputeCandidate[] = disputes
    .filter((d) => d.invoice)
    .map((d) => ({
      invoiceId: d.invoice_id,
      supplierVat: d.invoice!.supplier_vat,
      number: d.invoice!.document_number,
      date: d.invoice!.document_date,
      requestedCents: Number(d.requested_cents),
      disputedAt: d.created_at,
    }));
  const noteCents = Math.abs(toCents(note.totals.taxable));
  const now = new Date().toISOString();
  const hit = matchCreditNote(note, candidates);

  let targetInvoiceId: string | null = hit?.invoiceId ?? null;
  if (!targetInvoiceId) {
    // No dispute: link to the invoice it explicitly references, if any.
    for (const refDoc of note.linkedInvoices) {
      if (!refDoc.id) continue;
      const { data } = await db
        .from("supplier_invoices")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("supplier_vat", vat)
        .eq("document_number", refDoc.id)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        targetInvoiceId = data.id as string;
        break;
      }
    }
  }
  if (!targetInvoiceId) return null;

  await db.from("supplier_invoices").update({ credit_note_for: targetInvoiceId }).eq("id", creditNoteId);
  const { data: target } = await db
    .from("supplier_invoices")
    .select("id, recovered_cents, open_cents, supplier_name, document_number, document_type, supplier_id, catalog_id")
    .eq("id", targetInvoiceId)
    .maybeSingle();
  if (!target) return null;

  const open = disputes.filter((d) => d.invoice_id === targetInvoiceId);
  const requested = open.reduce((s, d) => s + Number(d.requested_cents), 0);
  const recovered = requested > 0 ? Math.min(requested, noteCents) : Math.min(Number(target.open_cents ?? 0), noteCents);
  for (const d of open) {
    await db
      .from("supplier_invoice_disputes")
      .update({ credit_note_id: creditNoteId, recovered_cents: Math.min(Number(d.requested_cents), noteCents), resolution: "credit_note", resolved_at: now })
      .eq("id", d.id);
  }
  if (recovered > 0) {
    await db.from("supplier_invoice_findings").update({ status: "resolved", resolved_at: now }).eq("invoice_id", targetInvoiceId).in("status", ["open", "disputed"]).eq("recoverable", true);
    await db
      .from("supplier_invoices")
      .update({ recovered_cents: Number(target.recovered_cents ?? 0) + (requested > 0 ? 0 : recovered), resolved_at: now })
      .eq("id", targetInvoiceId);
  }
  await refreshInvoiceStatus(db, targetInvoiceId, {
    isCreditNote: CREDIT_NOTE_TYPES.has(String(target.document_type)),
    supplierKnown: !!(target.supplier_id || target.catalog_id),
    matchedOrders: 1,
    priceChecked: true,
    supplierName: target.supplier_name as string | null,
    number: String(target.document_number),
    documentType: String(target.document_type),
  });
  return { invoiceId: targetInvoiceId, invoiceNumber: String(target.document_number), recoveredCents: recovered };
}

/** Re-run reconciliation of a stored invoice (after linking a supplier). */
export async function reprocessInvoice(db: Db, restaurantId: string, invoiceId: string): Promise<IngestedInvoice | null> {
  const { data: row } = await db
    .from("supplier_invoices")
    .select("id, body_index, document_date, file:supplier_invoice_files!file_id (xml, source_kind)")
    .eq("id", invoiceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!row?.file) return null;
  const parsed =
    row.file.source_kind === "json"
      ? parseFatturaElement(jsonToElement("FatturaElettronica", JSON.parse(row.file.xml as string)))
      : parseFatturaPA(row.file.xml as string);
  const inv = parsed.invoices.find((i) => i.bodyIndex === row.body_index) ?? parsed.invoices[0];
  if (!inv) return null;
  const date = (row.document_date as string | null) ?? new Date().toISOString().slice(0, 10);
  const ref = await loadReferenceData(restaurantId, { from: addDaysIso(date, -75), to: addDaysIso(date, 10) });
  // Lines of this invoice must not count as "already invoiced" for itself.
  const own = await rows<{ order_line_ref: string | null }>(
    db.from("supplier_invoice_lines").select("order_line_ref").eq("invoice_id", invoiceId),
    "own refs",
  );
  for (const o of own) if (o.order_line_ref) ref.alreadyInvoiced.delete(o.order_line_ref);
  const supplier = resolveSupplier(inv.supplier.vatNumber, inv.supplier.name, ref);
  await db
    .from("supplier_invoices")
    .update({ supplier_id: supplier.supplierId, catalog_id: supplier.catalogId, relationship_id: supplier.relationshipId })
    .eq("id", invoiceId);
  return reconcileAndStore(db, restaurantId, invoiceId, inv, supplier, ref);
}

/** Service-role client for trusted jobs (webhook, cron). */
export function serviceDb(): Db {
  return createAdminClient() as Db;
}
