// lib/invoices/server/queries.ts
// Read models for Finanze → Fatture fornitori. All queries take the user
// client (RLS: analytics.financial) and an already-authorized restaurant id.

import "server-only";
import { CREDIT_NOTE_GRACE_DAYS, monthlySummary, type InvoiceKpiRow, type MonthlyRow } from "../status.ts";
import type { FindingKind, FindingSeverity, FindingStatus, InvoiceStatus } from "../types.ts";
import { buildPriceSeries, type PriceHistoryRow, type PriceSeries } from "../price-history.ts";
import { addDaysIso, chunks, isoDate, rows, type Db } from "./db";

export interface InboxRow {
  id: string;
  supplier_name: string | null;
  supplier_vat: string | null;
  supplier_id: string | null;
  catalog_id: string | null;
  document_type: string;
  document_number: string;
  document_date: string | null;
  total_amount: number;
  taxable_amount: number;
  status: InvoiceStatus;
  open_cents: number;
  found_cents: number;
  disputed_cents: number;
  recovered_cents: number;
  findings_count: number;
  received_via: string;
  created_at: string;
  credit_note_for: string | null;
}

const INBOX_COLS =
  "id, supplier_name, supplier_vat, supplier_id, catalog_id, document_type, document_number, document_date, total_amount, taxable_amount, status, open_cents, found_cents, disputed_cents, recovered_cents, findings_count, received_via, created_at, credit_note_for";

export async function getInbox(db: Db, restaurantId: string, limit = 400): Promise<InboxRow[]> {
  return rows<InboxRow>(
    db
      .from("supplier_invoices")
      .select(INBOX_COLS)
      .eq("restaurant_id", restaurantId)
      .order("document_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    "inbox",
  );
}

export interface InvoiceKpis {
  toRecoverCents: number;
  disputedCents: number;
  recoveredCents: number;
  foundCents: number;
  invoicesCount: number;
  monthSpendCents: number;
  monthly: MonthlyRow[];
  staleDisputes: number;
}

export async function getInvoiceKpis(db: Db, restaurantId: string): Promise<InvoiceKpis> {
  const since = addDaysIso(isoDate(new Date()), -400);
  const data = await rows<{
    document_date: string | null;
    document_type: string;
    taxable_amount: number;
    status: InvoiceStatus;
    open_cents: number;
    disputed_cents: number;
    recovered_cents: number;
    found_cents: number;
  }>(
    db
      .from("supplier_invoices")
      .select("document_date, document_type, taxable_amount, status, open_cents, disputed_cents, recovered_cents, found_cents")
      .eq("restaurant_id", restaurantId)
      .gte("document_date", since)
      .limit(20000),
    "kpis",
  );
  const graceLimit = new Date(Date.now() - CREDIT_NOTE_GRACE_DAYS * 86400 * 1000).toISOString();
  const stale = await rows<{ id: string }>(
    db.from("supplier_invoice_disputes").select("id").eq("restaurant_id", restaurantId).is("resolved_at", null).lte("created_at", graceLimit),
    "stale disputes",
  );
  const kpiRows: InvoiceKpiRow[] = data.map((r) => ({
    docDate: r.document_date,
    documentType: r.document_type,
    taxableCents: Math.round(Number(r.taxable_amount) * 100),
    status: r.status,
    openRecoverableCents: Number(r.open_cents),
    disputedCents: Number(r.disputed_cents),
    recoveredCents: Number(r.recovered_cents),
    foundCents: Number(r.found_cents),
  }));
  const monthly = monthlySummary(kpiRows, 6);
  const current = monthly[monthly.length - 1];
  return {
    toRecoverCents: kpiRows.reduce((s, r) => s + r.openRecoverableCents, 0),
    disputedCents: kpiRows.reduce((s, r) => s + r.disputedCents, 0),
    recoveredCents: kpiRows.reduce((s, r) => s + r.recoveredCents, 0),
    foundCents: kpiRows.reduce((s, r) => s + r.foundCents, 0),
    invoicesCount: kpiRows.length,
    monthSpendCents: current?.spendCents ?? 0,
    monthly,
    staleDisputes: stale.length,
  };
}

export interface UpcomingPayment {
  id: string;
  invoice_id: string;
  due_date: string | null;
  amount: number | null;
  method: string | null;
  iban: string | null;
  supplier_name: string | null;
  document_number: string;
  overdue: boolean;
}

export async function getUpcomingPayments(db: Db, restaurantId: string, days = 30): Promise<UpcomingPayment[]> {
  const until = addDaysIso(isoDate(new Date()), days);
  const today = isoDate(new Date());
  const data = await rows<{
    id: string;
    invoice_id: string;
    due_date: string | null;
    amount: number | null;
    method: string | null;
    iban: string | null;
    invoice: { supplier_name: string | null; document_number: string } | null;
  }>(
    db
      .from("supplier_invoice_payments")
      .select("id, invoice_id, due_date, amount, method, iban, invoice:supplier_invoices!invoice_id (supplier_name, document_number)")
      .eq("restaurant_id", restaurantId)
      .is("paid_at", null)
      .not("due_date", "is", null)
      .lte("due_date", until)
      .order("due_date", { ascending: true })
      .limit(60),
    "payments",
  );
  return data.map((p) => ({
    id: p.id,
    invoice_id: p.invoice_id,
    due_date: p.due_date,
    amount: p.amount !== null ? Number(p.amount) : null,
    method: p.method,
    iban: p.iban,
    supplier_name: p.invoice?.supplier_name ?? null,
    document_number: p.invoice?.document_number ?? "",
    overdue: !!p.due_date && p.due_date < today,
  }));
}

export interface PriceIncrease {
  priceKey: string;
  description: string;
  supplierName: string | null;
  unitLabel: string;
  previous: number;
  latest: number;
  pct: number;
  date: string | null;
  invoiceId: string;
}

/** Latest vs previous purchase price per product (last 180 days). */
export async function getPriceIncreases(db: Db, restaurantId: string, minPct = 3): Promise<PriceIncrease[]> {
  const since = addDaysIso(isoDate(new Date()), -180);
  const hist = await rows<{
    price_key: string;
    description: string;
    supplier_name: string | null;
    unit: string | null;
    unit_price: number;
    price_kg: number | null;
    price_l: number | null;
    price_pz: number | null;
    document_date: string | null;
    invoice_id: string;
  }>(
    db
      .from("purchase_price_history")
      .select("price_key, description, supplier_name, unit, unit_price, price_kg, price_l, price_pz, document_date, invoice_id")
      .eq("restaurant_id", restaurantId)
      .gte("document_date", since)
      .order("document_date", { ascending: false })
      .limit(5000),
    "price history",
  );
  const byKey = new Map<string, typeof hist>();
  for (const h of hist) byKey.set(h.price_key, [...(byKey.get(h.price_key) ?? []), h]);
  const out: PriceIncrease[] = [];
  for (const [key, list] of byKey) {
    const latest = list[0]!;
    const prev = list.find((h) => h.invoice_id !== latest.invoice_id);
    if (!prev) continue;
    const pick = (h: (typeof list)[number]): [number, string] | null => {
      if (latest.price_kg !== null && h.price_kg !== null) return [Number(h.price_kg), "kg"];
      if (latest.price_l !== null && h.price_l !== null) return [Number(h.price_l), "l"];
      if (latest.price_pz !== null && h.price_pz !== null) return [Number(h.price_pz), "pz"];
      if ((h.unit ?? "") === (latest.unit ?? "")) return [Number(h.unit_price), latest.unit ?? "unità"];
      return null;
    };
    const a = pick(latest);
    const b = pick(prev);
    if (!a || !b || b[0] <= 0) continue;
    const pct = ((a[0] - b[0]) / b[0]) * 100;
    if (pct < minPct) continue;
    out.push({
      priceKey: key,
      description: latest.description,
      supplierName: latest.supplier_name,
      unitLabel: a[1],
      previous: b[0],
      latest: a[0],
      pct,
      date: latest.document_date,
      invoiceId: latest.invoice_id,
    });
  }
  return out.sort((x, y) => y.pct - x.pct).slice(0, 20);
}

export interface InvoiceDetail {
  invoice: InboxRow & {
    parsed: Record<string, unknown>;
    relationship_id: string | null;
    match_method: string | null;
    match_confidence: number | null;
    matched_order_ids: string[];
    vat_amount: number;
    buyer_name: string | null;
    buyer_vat: string | null;
    disputed_at: string | null;
    resolved_at: string | null;
    file_id: string;
  };
  lines: Array<{
    id: string;
    line_number: number;
    kind: string;
    description: string;
    item_codes: Array<{ type: string; value: string }>;
    quantity: number | null;
    unit: string | null;
    unit_price: number;
    total_price: number;
    vat_rate: number;
    natura: string | null;
    discounts: Array<{ type: string; percent: number | null; amount: number | null }>;
    ddt_number: string | null;
    ddt_date: string | null;
    order_id: string | null;
    order_line_ref: string | null;
    match_score: number | null;
    agreed_unit_price: number | null;
    agreed_source: string | null;
    effective_unit_price: number | null;
    ordered_qty: number | null;
    received_qty: number | null;
    quantity_source: string | null;
    dimension: string | null;
    note: string | null;
  }>;
  findings: Array<{
    id: string;
    line_number: number | null;
    kind: FindingKind;
    severity: FindingSeverity;
    impact_cents: number;
    recoverable: boolean;
    title: string;
    message: string;
    status: FindingStatus;
    details: Record<string, unknown>;
  }>;
  payments: Array<{ id: string; installment: number; due_date: string | null; amount: number | null; method: string | null; iban: string | null; paid_at: string | null }>;
  disputes: Array<{
    id: string;
    message: string;
    channel: string;
    requested_cents: number;
    recovered_cents: number;
    created_at: string;
    resolved_at: string | null;
    resolution: string | null;
    credit_note_id: string | null;
  }>;
  creditNotes: Array<{ id: string; document_number: string; document_date: string | null; taxable_amount: number }>;
  orders: Array<{ id: string; created_at: string; status: string }>;
  supplier: { email: string | null; phone: string | null; chatAvailable: boolean };
  /** order_line_ref → name of the ordered product / received lot numbers. */
  lineContext: Record<string, { orderedName: string | null; lots: string[] }>;
  /** Invoice this credit note settles. */
  creditNoteOf: { id: string; document_number: string } | null;
}

export async function getInvoiceDetail(db: Db, restaurantId: string, id: string): Promise<InvoiceDetail | null> {
  const { data: invoice } = await db
    .from("supplier_invoices")
    .select(
      `${INBOX_COLS}, parsed, relationship_id, match_method, match_confidence, matched_order_ids, vat_amount, buyer_name, buyer_vat, disputed_at, resolved_at, file_id`,
    )
    .eq("id", id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!invoice) return null;
  const [lines, findings, payments, disputes, creditNotes, orders] = await Promise.all([
    rows<InvoiceDetail["lines"][number]>(
      db
        .from("supplier_invoice_lines")
        .select(
          "id, line_number, kind, description, item_codes, quantity, unit, unit_price, total_price, vat_rate, natura, discounts, ddt_number, ddt_date, order_id, order_line_ref, match_score, agreed_unit_price, agreed_source, effective_unit_price, ordered_qty, received_qty, quantity_source, dimension, note",
        )
        .eq("invoice_id", id)
        .order("line_number", { ascending: true }),
      "detail lines",
    ),
    rows<InvoiceDetail["findings"][number]>(
      db
        .from("supplier_invoice_findings")
        .select("id, line_number, kind, severity, impact_cents, recoverable, title, message, status, details")
        .eq("invoice_id", id)
        .order("impact_cents", { ascending: false }),
      "detail findings",
    ),
    rows<InvoiceDetail["payments"][number]>(
      db.from("supplier_invoice_payments").select("id, installment, due_date, amount, method, iban, paid_at").eq("invoice_id", id).order("installment"),
      "detail payments",
    ),
    rows<InvoiceDetail["disputes"][number]>(
      db
        .from("supplier_invoice_disputes")
        .select("id, message, channel, requested_cents, recovered_cents, created_at, resolved_at, resolution, credit_note_id")
        .eq("invoice_id", id)
        .order("created_at", { ascending: false }),
      "detail disputes",
    ),
    rows<InvoiceDetail["creditNotes"][number]>(
      db.from("supplier_invoices").select("id, document_number, document_date, taxable_amount").eq("credit_note_for", id),
      "credit notes",
    ),
    (invoice.matched_order_ids as string[]).length > 0
      ? rows<InvoiceDetail["orders"][number]>(
          db.from("orders").select("id, created_at, status").in("id", invoice.matched_order_ids as string[]),
          "orders",
        )
      : Promise.resolve([]),
  ]);
  let supplier: InvoiceDetail["supplier"] = { email: null, phone: null, chatAvailable: false };
  if (invoice.supplier_id) {
    const { data: s } = await db.from("suppliers").select("email, phone").eq("id", invoice.supplier_id).maybeSingle();
    supplier = { email: s?.email ?? null, phone: s?.phone ?? null, chatAvailable: !!invoice.relationship_id };
  }
  const parsedSupplier = (invoice.parsed as { supplier?: { email?: string | null; phone?: string | null } })?.supplier;
  supplier.email = supplier.email ?? parsedSupplier?.email ?? null;
  supplier.phone = supplier.phone ?? parsedSupplier?.phone ?? null;

  // Ordered product names (marketplace order lines) + received lots.
  const lineContext: InvoiceDetail["lineContext"] = {};
  const refs = [...new Set(lines.map((l) => l.order_line_ref).filter((r): r is string => !!r))];
  const uuidRefs = refs.filter((r) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r));
  for (const part of chunks(uuidRefs)) {
    const items = await rows<{ id: string; product: { name: string } | null }>(
      db.from("order_items").select("id, product:products!product_id (name)").in("id", part),
      "detail order items",
    );
    for (const it of items) lineContext[it.id] = { orderedName: it.product?.name ?? null, lots: [] };
  }
  const orderIds = (invoice.matched_order_ids as string[]) ?? [];
  if (orderIds.length > 0) {
    const rec = await db
      .from("restaurant_received_lines")
      .select("order_id, order_item_id, line_ref, lot_number")
      .in("order_id", orderIds.slice(0, 50))
      .not("lot_number", "is", null);
    if (!rec.error) {
      for (const r of (rec.data ?? []) as Array<{ order_item_id: string | null; line_ref: string; lot_number: string | null }>) {
        const key = r.order_item_id ?? r.line_ref;
        if (!key || !r.lot_number) continue;
        const cur = lineContext[key] ?? { orderedName: null, lots: [] };
        if (!cur.lots.includes(r.lot_number)) cur.lots.push(r.lot_number);
        lineContext[key] = cur;
      }
    }
  }

  let creditNoteOf: InvoiceDetail["creditNoteOf"] = null;
  if (invoice.credit_note_for) {
    const { data: target } = await db
      .from("supplier_invoices")
      .select("id, document_number")
      .eq("id", invoice.credit_note_for)
      .maybeSingle();
    if (target) creditNoteOf = { id: target.id as string, document_number: String(target.document_number) };
  }

  return {
    invoice: invoice as InvoiceDetail["invoice"],
    lines,
    findings,
    payments,
    disputes,
    creditNotes,
    orders,
    supplier,
    lineContext,
    creditNoteOf,
  };
}

/** Purchase price history per product (last `days`). */
export async function getPriceSeries(db: Db, restaurantId: string, days = 365, priceKey?: string): Promise<PriceSeries[]> {
  const since = addDaysIso(isoDate(new Date()), -days);
  let q = db
    .from("purchase_price_history")
    .select("price_key, description, supplier_name, unit, quantity, unit_price, price_kg, price_l, price_pz, document_date, invoice_id")
    .eq("restaurant_id", restaurantId)
    .gte("document_date", since);
  if (priceKey) q = q.eq("price_key", priceKey);
  const hist = await rows<PriceHistoryRow>(q.order("document_date", { ascending: false }).limit(priceKey ? 500 : 8000), "price series");
  return buildPriceSeries(hist);
}

/** Latest manual upload (for the connections panel). */
export async function getLastUploadAt(db: Db, restaurantId: string): Promise<string | null> {
  const { data } = await db
    .from("supplier_invoice_files")
    .select("created_at")
    .eq("restaurant_id", restaurantId)
    .eq("source", "upload")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

export interface AttentionItem {
  id: string;
  supplier_name: string | null;
  document_number: string;
  document_date: string | null;
  status: InvoiceStatus;
  open_cents: number;
  disputed_cents: number;
  findings_count: number;
}

/** Invoices that need a look (anomalies first, by € impact). */
export async function getAttentionInvoices(db: Db, restaurantId: string, limit = 6): Promise<AttentionItem[]> {
  return rows<AttentionItem>(
    db
      .from("supplier_invoices")
      .select("id, supplier_name, document_number, document_date, status, open_cents, disputed_cents, findings_count")
      .eq("restaurant_id", restaurantId)
      .in("status", ["anomalie", "da_verificare"])
      .order("open_cents", { ascending: false })
      .order("document_date", { ascending: false })
      .limit(limit),
    "attention",
  );
}

/** Connected suppliers and catalogs, to link an unknown P.IVA by hand. */
export async function getLinkOptions(db: Db, restaurantId: string) {
  const [rels, catalogs] = await Promise.all([
    rows<{ supplier_id: string; supplier: { company_name: string } | null }>(
      db.from("restaurant_suppliers").select("supplier_id, supplier:suppliers!supplier_id (company_name)").eq("restaurant_id", restaurantId),
      "link suppliers",
    ),
    rows<{ id: string; supplier_name: string }>(
      db.from("restaurant_catalogs").select("id, supplier_name").eq("restaurant_id", restaurantId).order("supplier_name"),
      "link catalogs",
    ),
  ]);
  return {
    suppliers: rels.filter((r) => r.supplier).map((r) => ({ id: r.supplier_id, name: r.supplier!.company_name })),
    catalogs: catalogs.map((c) => ({ id: c.id, name: c.supplier_name })),
  };
}
