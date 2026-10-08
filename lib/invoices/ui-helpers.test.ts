import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractInvoiceDocuments } from "./archive.ts";
import { compareLine } from "./compare.ts";
import { buildDigest } from "./digest.ts";
import { parseFatturaPA, stripAttachments } from "./fatturapa.ts";
import {
  connectionLabel,
  connectionPhase,
  portalSteps,
  relativeDayIt,
  supplierNoticeEmail,
  supplierNoticeWhatsApp,
  whatsappShareUrl,
} from "./onboarding.ts";
import { buildPriceSeries, type PriceHistoryRow } from "./price-history.ts";
import { overallHealth, posCard, posPlaceholderCard, sdiCard } from "../finance/connections.ts";

const FIX = new URL("../../tests/fixtures/invoices/", import.meta.url);
const bytes = (name: string) => new Uint8Array(readFileSync(new URL(name, FIX)));

/* ------------------------------------------------------------------ */
/* Upload path used by the browser (extract → strip → parse)            */
/* ------------------------------------------------------------------ */

test("upload path: every fixture extracts and still parses after stripping attachments", () => {
  const names = [
    "IT01234567890_FPR01.xml",
    "IT01234567890_FPR01.xml.p7m",
    "IT01234567890_FPR01_base64.xml.p7m",
    "IT01234567890_FPR01_doppia.xml.p7m.p7m",
    "IT01234567890_NC01.xml",
    "IT02345678901_TD24_ber.xml.p7m",
    "IT02345678901_TD24_latin1.xml",
    "IT03456789012_lotto.xml",
    "IT04567890123_semplificata.xml",
  ];
  for (const n of names) {
    const ex = extractInvoiceDocuments(n, bytes(n));
    assert.equal(ex.documents.length, 1, `${n}: one document`);
    const stripped = stripAttachments(ex.documents[0]!.xml);
    const parsed = parseFatturaPA(stripped);
    assert.ok(parsed.invoices.length >= 1, `${n}: parses after strip (${parsed.errors.join("; ")})`);
  }
});

test("upload path: SDI metadata file is skipped, not imported", () => {
  const ex = extractInvoiceDocuments("IT01234567890_FPR01_MT_001.xml", bytes("IT01234567890_FPR01_MT_001.xml"));
  assert.equal(ex.documents.length, 0);
  assert.match(ex.skipped[0]!.reason, /metadati/i);
});

/* ------------------------------------------------------------------ */
/* Price history                                                        */
/* ------------------------------------------------------------------ */

const row = (over: Partial<PriceHistoryRow>): PriceHistoryRow => ({
  price_key: "p:mozz",
  description: "Mozzarella fiordilatte",
  supplier_name: "Caseificio Rossi",
  unit: "KG",
  quantity: 10,
  unit_price: 8,
  price_kg: 8,
  price_l: null,
  price_pz: null,
  document_date: "2026-08-01",
  invoice_id: "inv-1",
  ...over,
});

test("price series: sorted points, latest vs previous purchase, min/max", () => {
  const series = buildPriceSeries([
    row({ document_date: "2026-09-15", unit_price: 9, price_kg: 9, invoice_id: "inv-3" }),
    row({}),
    row({ document_date: "2026-09-01", unit_price: 8.4, price_kg: 8.4, invoice_id: "inv-2" }),
    row({ price_key: "c:cat:farina", description: "Farina 00", price_kg: 0.9, unit_price: 22.5, unit: "SC", document_date: "2026-07-01" }),
  ]);
  assert.equal(series.length, 2);
  const mozz = series.find((s) => s.priceKey === "p:mozz")!;
  assert.deepEqual(
    mozz.points.map((p) => p.price),
    [8, 8.4, 9],
  );
  assert.equal(mozz.latest, 9);
  assert.equal(mozz.min, 8);
  assert.equal(mozz.max, 9);
  assert.equal(mozz.unitLabel, "kg");
  assert.equal(Math.round(mozz.lastChangePct! * 10) / 10, 7.1);
  assert.equal(Math.round(mozz.periodChangePct! * 10) / 10, 12.5);
  assert.equal(mozz.purchases, 3);
  // Most recent product first.
  assert.equal(series[0]!.priceKey, "p:mozz");
});

test("price series: falls back to invoice unit price when no base price", () => {
  const [s] = buildPriceSeries([
    row({ price_key: "i:x:vino", price_kg: null, unit: "BT", unit_price: 6, invoice_id: "a", document_date: "2026-08-01" }),
    row({ price_key: "i:x:vino", price_kg: null, unit: "BT", unit_price: 6.5, invoice_id: "b", document_date: "2026-09-01" }),
  ]);
  assert.equal(s!.unitLabel, "bt");
  assert.equal(s!.latest, 6.5);
  assert.ok(s!.lastChangePct! > 8);
});

/* ------------------------------------------------------------------ */
/* Line comparison (ordine ↔ DDT ↔ fattura)                             */
/* ------------------------------------------------------------------ */

const line = {
  line_number: 2,
  kind: "goods",
  quantity: 6,
  unit_price: 26.5,
  effective_unit_price: 26.5,
  total_price: 159,
  agreed_unit_price: 25.2,
  agreed_source: "order",
  ordered_qty: 6,
  received_qty: 5.5,
  ddt_number: "456",
  order_id: "order-1",
};

test("compare: price and quantity differences with € impact of live findings", () => {
  const cmp = compareLine(line, [
    { line_number: 2, kind: "price_above_agreed", impact_cents: 780, recoverable: true, status: "open" },
    { line_number: 2, kind: "qty_above_received", impact_cents: 1325, recoverable: true, status: "disputed" },
    { line_number: 3, kind: "not_ordered", impact_cents: 500, recoverable: true, status: "open" },
  ]);
  assert.equal(cmp.priceDiff, true);
  assert.equal(cmp.qtyDiff, true);
  assert.equal(cmp.impactCents, 2105);
  assert.equal(cmp.tone, "diff");
  assert.deepEqual(cmp.delivered, { qty: 5.5, ddt: "456" });
  assert.equal(cmp.ordered?.price, 25.2);
});

test("compare: resolved findings leave the line settled and without impact", () => {
  const cmp = compareLine({ ...line, unit_price: 25.2, effective_unit_price: 25.2, quantity: 5.5, total_price: 138.6 }, [
    { line_number: 2, kind: "price_above_agreed", impact_cents: 780, recoverable: true, status: "resolved" },
  ]);
  assert.equal(cmp.impactCents, 0);
  assert.equal(cmp.settled, true);
  assert.equal(cmp.tone, "ok");
});

/* ------------------------------------------------------------------ */
/* Onboarding copy and status                                           */
/* ------------------------------------------------------------------ */

const notice = { companyName: "Trattoria Da Mario srl", fiscalId: "01234567890", recipientCode: "JKKZDGR" };

test("onboarding: supplier notices carry P.IVA and codice destinatario", () => {
  for (const text of [supplierNoticeWhatsApp(notice), supplierNoticeEmail(notice)]) {
    assert.match(text, /01234567890/);
    assert.match(text, /JKKZDGR/);
    assert.match(text, /DDT/);
  }
  assert.ok(whatsappShareUrl("a b").startsWith("https://wa.me/?text=a%20b"));
  const steps = portalSteps("JKKZDGR");
  assert.equal(steps.length, 3);
  assert.match(steps[1]!.title, /indirizzo telematico/);
  assert.match(steps[2]!.title, /JKKZDGR/);
});

test("onboarding: live status labels", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  assert.equal(connectionPhase({ providerConfigured: false, status: null, lastInvoiceAt: null, lastError: null }), "inactive");
  assert.equal(connectionPhase({ providerConfigured: true, status: null, lastInvoiceAt: null, lastError: null }), "not_connected");
  assert.equal(connectionLabel({ providerConfigured: true, status: "pending", lastInvoiceAt: null, lastError: null }, now), "In attesa della prima fattura");
  assert.equal(
    connectionLabel({ providerConfigured: true, status: "active", lastInvoiceAt: "2026-10-07T15:00:00Z", lastError: null }, now),
    "Collegato ✓, ultima fattura ricevuta ieri",
  );
  assert.equal(relativeDayIt("2026-10-05T09:00:00Z", now), "3 giorni fa");
  assert.equal(relativeDayIt("2026-09-12T09:00:00Z", now), "il 12/09/2026");
});

/* ------------------------------------------------------------------ */
/* Stato collegamenti                                                   */
/* ------------------------------------------------------------------ */

test("connections: POS health and fix-it actions", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  const base = { id: "i1", provider: "cassa_in_cloud", display_name: null, last_error: null };
  assert.equal(posCard({ ...base, status: "active", last_synced_at: "2026-10-08T08:00:00Z" }, now).health, "ok");
  const stale = posCard({ ...base, status: "active", last_synced_at: "2026-10-04T08:00:00Z" }, now);
  assert.equal(stale.health, "warning");
  assert.equal(posCard({ ...base, status: "paused", last_synced_at: null }, now).fix?.action, "resume_pos");
  assert.match(posCard({ ...base, status: "pending_auth", last_synced_at: null }, now).fix!.label, /chiave API/);
  assert.equal(posCard({ ...base, status: "error", last_synced_at: null, last_error: "401" }, now).health, "error");
  assert.equal(posPlaceholderCard(false, false)?.status, "Nessuna cassa collegata");
  assert.equal(posPlaceholderCard(true, true), null);
});

test("connections: SDI states and overall health", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  const conn = {
    status: "active" as const,
    recipient_code: "JKKZDGR",
    portal_confirmed_at: "2026-09-01T00:00:00Z",
    last_invoice_at: "2026-10-07T09:00:00Z",
    last_sync_at: "2026-10-08T05:00:00Z",
    last_error: null,
  };
  const inactive = sdiCard({ providerConfigured: false, connection: null, lastUploadAt: null }, now);
  assert.equal(inactive.health, "off");
  assert.match(inactive.status, /non ancora attiva/);
  assert.equal(sdiCard({ providerConfigured: true, connection: null, lastUploadAt: null }, now).fix?.href, "/finanze/fatture/collega");
  assert.equal(sdiCard({ providerConfigured: true, connection: conn, lastUploadAt: null }, now).health, "ok");
  const quiet = sdiCard({ providerConfigured: true, connection: { ...conn, last_invoice_at: "2026-08-01T00:00:00Z" }, lastUploadAt: null }, now);
  assert.equal(quiet.health, "warning");
  assert.equal(overallHealth([inactive, quiet]), "warning");
});

/* ------------------------------------------------------------------ */
/* Daily digest                                                         */
/* ------------------------------------------------------------------ */

test("digest: anomalies, dishes over target and payments due in one line", () => {
  const d = buildDigest({
    newInvoices: 3,
    anomalies: 2,
    openCents: 4250,
    dueCount: 1,
    dueCents: 120000,
    overdueCount: 0,
    staleDisputes: 0,
    dishesOverTarget: 2,
  });
  assert.equal(d.parts.length, 4);
  assert.match(d.parts[0]!, /2 fatture con anomalie \(42,50\s€ da recuperare\)/);
  assert.match(d.parts.join(" · "), /2 piatti sopra il food cost obiettivo/);
  assert.match(d.parts.join(" · "), /1 scadenza entro 7 giorni/);
  assert.equal(d.link, "/finanze/fatture?stato=anomalie");
  const empty = buildDigest({ newInvoices: 0, anomalies: 0, openCents: 0, dueCount: 0, dueCents: 0, overdueCount: 0, staleDisputes: 0, dishesOverTarget: 0 });
  assert.equal(empty.parts.length, 0);
});
