import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFatturaPA } from "./fatturapa.ts";
import { decodeXmlBytes } from "./decode.ts";
import { normalizeDdtNumber, reconcileInvoice, type CandidateOrder, type ReconcileInput } from "./match.ts";
import { matchCreditNote } from "./credit-notes.ts";
import { buildDisputeMessage, requestedCreditCents } from "./dispute.ts";
import { deriveStatus, monthlySummary } from "./status.ts";
import { commonDimension, measureOf, parsePack, basePrices, canonicalUnit } from "./units.ts";
import { productSimilarity, companySimilarity } from "./text.ts";
import { checkVatRate } from "./vat.ts";

const FIX = new URL("../../tests/fixtures/invoices/", import.meta.url);
const load = (name: string) => parseFatturaPA(decodeXmlBytes(new Uint8Array(readFileSync(new URL(name, FIX))))).invoices[0]!;

const meatOrder: CandidateOrder = {
  id: "order-1",
  date: "2026-09-10",
  deliveryDate: "2026-09-12",
  ddtNumbers: ["456"],
  lines: [
    { ref: "oi-gua", orderId: "order-1", productId: "p-gua", priceKey: "p:p-gua", name: "Guanciale stagionato", sku: "GUA001", unit: "kg", quantity: 5, receivedQty: 5, unitPrice: 12, vatRate: 10 },
    { ref: "oi-fil", orderId: "order-1", productId: "p-fil", priceKey: "p:p-fil", name: "Filetto di manzo", sku: null, unit: "kg", quantity: 6, receivedQty: 5.5, unitPrice: 25.2, vatRate: 10 },
  ],
};

const baseInput = (over: Partial<ReconcileInput> = {}): ReconcileInput => ({
  invoice: load("IT01234567890_FPR01.xml"),
  supplierKnown: true,
  orders: [meatOrder],
  priceList: [],
  existing: [],
  receivingAvailable: true,
  fallbackKeyPrefix: "i:01234567890",
  ...over,
});

test("DDT number normalisation", () => {
  assert.equal(normalizeDdtNumber("DDT 0456/2026"), "456");
  assert.equal(normalizeDdtNumber("n. 456"), "456");
  assert.equal(normalizeDdtNumber("1201-A"), "1201A");
});

test("3-way match by DDT: price above agreed, billed > received, not ordered", () => {
  const r = reconcileInvoice(baseInput());
  assert.equal(r.method, "ddt");
  assert.deepEqual(r.orderIds, ["order-1"]);
  const kinds = r.findings.map((f) => f.kind).sort();
  assert.deepEqual(kinds, ["not_ordered", "not_ordered", "price_above_agreed", "qty_above_received"]);

  const price = r.findings.find((f) => f.kind === "price_above_agreed")!;
  assert.equal(price.lineNumber, 1);
  assert.equal(price.impactCents, 1080); // (14.16 - 12) × 5 kg
  assert.equal(price.details.pct, 18);
  assert.equal(price.severity, "high");

  const qty = r.findings.find((f) => f.kind === "qty_above_received")!;
  assert.equal(qty.impactCents, 1260); // 0.5 kg × 25.20 €/kg (after 10% discount)
  assert.equal(qty.details.referenceSource, "received");

  const notOrdered = r.findings.filter((f) => f.kind === "not_ordered");
  const sal = notOrdered.find((f) => f.lineNumber === 3)!;
  assert.equal(sal.impactCents, 1900);
  assert.equal(sal.recoverable, true);
  const transport = notOrdered.find((f) => f.lineNumber === 4)!;
  assert.equal(transport.recoverable, false);
  assert.equal(transport.severity, "low");

  const line1 = r.lines.find((l) => l.lineNumber === 1)!;
  assert.equal(line1.orderLineRef, "oi-gua");
  assert.equal(line1.agreedUnitPrice, 12);
  assert.equal(line1.priceKey, "p:p-gua");
  const line3 = r.lines.find((l) => l.lineNumber === 3)!;
  assert.match(line3.priceKey, /^i:01234567890:/);
});

test("Without receiving data the quantity check uses the ordered quantity and says so", () => {
  const order = { ...meatOrder, lines: meatOrder.lines.map((l) => ({ ...l, receivedQty: null })) };
  const r = reconcileInvoice(baseInput({ orders: [order], receivingAvailable: false }));
  assert.equal(r.findings.some((f) => f.kind === "qty_above_received"), false);
  assert.equal(r.findings.some((f) => f.kind === "qty_above_ordered"), false); // 6 kg billed = 6 kg ordered
});

test("Date-window matching when the invoice has no matching DDT", () => {
  const order = { ...meatOrder, ddtNumbers: [] };
  const r = reconcileInvoice(baseInput({ orders: [order] }));
  assert.equal(r.method, "date_window");
  assert.deepEqual(r.orderIds, ["order-1"]);
});

test("Orders far outside the window are not used; catalog price is the fallback", () => {
  const old = { ...meatOrder, ddtNumbers: [], date: "2026-03-01", deliveryDate: "2026-03-02" };
  const r = reconcileInvoice(
    baseInput({
      orders: [old],
      priceList: [{ priceKey: "c:cat1:guanciale stagionat", productId: null, name: "Guanciale stagionato", sku: null, unit: "kg", price: 13, source: "catalog" }],
    }),
  );
  assert.deepEqual(r.orderIds, []);
  assert.equal(r.method, "price_list");
  const price = r.findings.find((f) => f.kind === "price_above_agreed")!;
  assert.equal(price.impactCents, 580); // (14.16 - 13) × 5
  assert.equal(price.details.agreedSource, "catalog");
  assert.ok(r.findings.some((f) => f.kind === "no_order_found"));
  assert.equal(r.findings.some((f) => f.kind === "not_ordered"), false);
});

test("Pack math: cartons vs bottles, pieces with weight, unit synonyms", () => {
  assert.deepEqual(parsePack("Passata di pomodoro 6x700g"), { count: 6, size: { qty: 0.7, base: "kg" } });
  assert.deepEqual(parsePack("Acqua naturale 0,5L x 24"), { count: 24, size: { qty: 0.5, base: "l" } });
  assert.deepEqual(parsePack("Olio EVO lt 5"), { count: null, size: { qty: 5, base: "l" } });
  assert.equal(parsePack("Uova fresche conf. 30 pz").count, 30);
  const billed = measureOf(2, "CT", "Acqua naturale 0,5L x 24");
  const ordered = measureOf(48, "bottiglia", "Acqua naturale 0,5 l");
  assert.equal(billed.pz, 48);
  assert.equal(commonDimension(billed, ordered), "l");
  const mozz = measureOf(10, "PZ", "Mozzarella fior di latte 125g x 8");
  assert.equal(mozz.kg, 10);
  assert.equal(canonicalUnit("KGM").code, "kg");
  assert.equal(canonicalUnit("Nr.").code, "pz");
  assert.equal(canonicalUnit("C62").kind, "count");
  assert.equal(basePrices(9.6, "CT", "Passata di pomodoro 6x700g").kg!.toFixed(4), "2.2857");
});

test("Price per carton vs order per kg is compared on kg", () => {
  const inv = load("IT02345678901_TD24_latin1.xml");
  const order: CandidateOrder = {
    id: "o2",
    date: "2026-09-08",
    deliveryDate: "2026-09-10",
    ddtNumbers: ["1201", "1244"],
    lines: [
      { ref: "c:o2:0", orderId: "o2", productId: null, priceKey: "c:cat:passat pomodor", name: "Passata di pomodoro 700 g", sku: null, unit: "pz", quantity: 12, receivedQty: null, unitPrice: 1.5, vatRate: null },
      { ref: "c:o2:1", orderId: "o2", productId: null, priceKey: "c:cat:lattug gentil", name: "Lattuga gentile", sku: null, unit: "kg", quantity: 3.5, receivedQty: null, unitPrice: 2.4, vatRate: null },
      { ref: "c:o2:2", orderId: "o2", productId: null, priceKey: "c:cat:mozzarell fior latte", name: "Mozzarella fior di latte 125 g", sku: null, unit: "pz", quantity: 80, receivedQty: null, unitPrice: 0.75, vatRate: null },
    ],
  };
  const r = reconcileInvoice({
    invoice: inv,
    supplierKnown: true,
    orders: [order],
    priceList: [],
    existing: [],
    receivingAvailable: false,
    fallbackKeyPrefix: "i:02345678901",
  });
  assert.equal(r.method, "ddt");
  const passata = r.lines.find((l) => l.lineNumber === 1)!;
  assert.equal(passata.orderLineRef, "c:o2:0");
  assert.equal(passata.dimension, "kg");
  // 9.60 per carton of 6 × 0.7 kg vs 1.50 per 0.7 kg piece → 6 × 1.50 = 9.00 per carton agreed
  assert.equal(passata.agreedUnitPrice, 9);
  const kinds = r.findings.map((f) => `${f.kind}:${f.lineNumber}`);
  assert.ok(kinds.includes("price_above_agreed:1"));
  assert.ok(kinds.includes("price_above_agreed:3"));
  assert.ok(kinds.includes("vat_anomaly:3")); // mozzarella at 10% (expected 4%)
  assert.ok(kinds.includes("not_ordered:4")); // caffè not in the order
  const vat = r.findings.find((f) => f.kind === "vat_anomaly")!;
  assert.equal(vat.recoverable, false);
});

test("Duplicates: exact number and same-amount same-day", () => {
  const inv = load("IT01234567890_FPR01.xml");
  const exact = reconcileInvoice(baseInput({ existing: [{ id: "x", supplierVat: "01234567890", documentType: "TD01", number: "FT 2026/0815", date: "2026-09-15", gross: 271.2 }] }));
  const dup = exact.findings.find((f) => f.kind === "duplicate_invoice")!;
  assert.equal(dup.severity, "high");
  assert.equal(dup.impactCents, 24600);
  const near = reconcileInvoice(baseInput({ existing: [{ id: "y", supplierVat: "01234567890", documentType: "TD01", number: "816", date: inv.date, gross: 271.2 }] }));
  assert.ok(near.findings.some((f) => f.kind === "possible_duplicate"));
});

test("Credit note: matched by reference, then by amount", () => {
  const nc = load("IT01234567890_NC01.xml");
  const candidates = [
    { invoiceId: "inv-a", supplierVat: "01234567890", number: "FT 2026/0815", date: "2026-09-15", requestedCents: 4240, disputedAt: "2026-09-20T10:00:00Z" },
    { invoiceId: "inv-b", supplierVat: "01234567890", number: "FT 2026/0700", date: "2026-08-10", requestedCents: 999, disputedAt: "2026-08-20T10:00:00Z" },
  ];
  assert.deepEqual(matchCreditNote(nc, candidates), { invoiceId: "inv-a", method: "reference" });
  const noRef = { ...nc, linkedInvoices: [], causale: [], lines: nc.lines.map((l) => ({ ...l, description: "Rettifica" })) };
  assert.deepEqual(matchCreditNote(noRef, candidates), { invoiceId: "inv-a", method: "amount" });
  assert.equal(matchCreditNote({ ...noRef, supplier: { ...noRef.supplier, vatNumber: "999" } }, candidates), null);
});

test("Dispute message is polite, itemised and asks for the credit note total", () => {
  const r = reconcileInvoice(baseInput());
  const selected = r.findings.filter((f) => f.recoverable);
  const msg = buildDisputeMessage({
    restaurantName: "Trattoria da Mario",
    supplierName: "Rossi Carni S.r.l.",
    invoiceNumber: "FT 2026/0815",
    invoiceDate: "2026-09-15",
    findings: selected,
  });
  assert.match(msg, /^Buongiorno Rossi Carni S\.r\.l\.,/);
  assert.match(msg, /fattura n\. FT 2026\/0815 del 15\/09\/2026/);
  assert.match(msg, /nota di credito di 42,40/);
  assert.equal(requestedCreditCents(selected), 4240);
  assert.ok(msg.length <= 2000);
});

test("Status derivation and monthly summary", () => {
  assert.equal(
    deriveStatus({ isCreditNote: false, supplierKnown: true, matchedOrders: 1, priceChecked: true, findings: [], disputed: false, resolved: false }),
    "ok",
  );
  assert.equal(
    deriveStatus({
      isCreditNote: false,
      supplierKnown: true,
      matchedOrders: 1,
      priceChecked: true,
      findings: [{ severity: "high", recoverable: true, impactCents: 100, status: "open", kind: "price_above_agreed" }],
      disputed: false,
      resolved: false,
    }),
    "anomalie",
  );
  assert.equal(
    deriveStatus({ isCreditNote: false, supplierKnown: false, matchedOrders: 0, priceChecked: false, findings: [], disputed: false, resolved: false }),
    "da_verificare",
  );
  const rows = monthlySummary(
    [
      { docDate: "2026-09-15", documentType: "TD01", taxableCents: 24600, status: "contestata", openRecoverableCents: 0, disputedCents: 4240, recoveredCents: 0, foundCents: 4240 },
      { docDate: "2026-09-29", documentType: "TD04", taxableCents: 4240, status: "ok", openRecoverableCents: 0, disputedCents: 0, recoveredCents: 0, foundCents: 0 },
    ],
    2,
    new Date("2026-10-07T00:00:00Z"),
  );
  assert.deepEqual(rows.map((r) => r.month), ["2026-09", "2026-10"]);
  assert.equal(rows[0]!.spendCents, 20360);
});

test("Similarity helpers", () => {
  assert.ok(productSimilarity("Guanciale stagionato di suino", "Guanciale stagionato") > 0.7);
  assert.ok(productSimilarity("MOZZ. FIOR DI LATTE 125G", "Mozzarella fior di latte") > 0.6);
  assert.ok(productSimilarity("Guanciale", "Acqua naturale") < 0.2);
  assert.ok(companySimilarity("Rossi Carni S.r.l.", "ROSSI CARNI SRL") > 0.95);
  assert.equal(checkVatRate("Mozzarella fior di latte", 4, null), null);
  assert.equal(checkVatRate("Vino rosso Chianti", 22, null), null);
  assert.equal(checkVatRate("Succo di pomodoro", 22, null), null);
  assert.ok(checkVatRate("Guanciale", 22, null));
  assert.equal(checkVatRate("Olio extravergine", 0, "N2.2"), null);
});
