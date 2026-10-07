// lib/invoices/match.ts
// 3-way reconciliation: ordine ↔ DDT/ricevimento ↔ fattura.
//
// Pure and deterministic. The server layer loads candidate orders (marketplace
// order_items and private-catalog orders parsed from orders.notes), received
// quantities (delivery check-in, when available), catalog/listino prices and
// previously imported invoices, then calls reconcileInvoice().
//
// Principle: a finding is raised only when the comparison is unambiguous
// (same product with good confidence, quantities on a common unit). Anything
// uncertain is left to the human, never inflated into "money to recover".

import { applyDiscounts, CREDIT_NOTE_TYPES, normalizeVat } from "./fatturapa.ts";
import { normalizeCode, productKeyName, productSimilarity } from "./text.ts";
import {
  commonDimension,
  measureOf,
  measureValue,
  type Dimension,
  type Measure,
  type PackHint,
} from "./units.ts";
import { checkVatRate } from "./vat.ts";
import type { Finding, FindingSeverity, ParsedInvoice, ParsedInvoiceLine } from "./types.ts";

/* ------------------------------------------------------------------ */
/* Inputs                                                               */
/* ------------------------------------------------------------------ */

export interface CandidateOrderLine {
  /** order_items.id, or "catalog:<orderId>:<index>" for catalog orders. */
  ref: string;
  orderId: string;
  productId: string | null;
  /** Price-history key of the product (see priceKey*). */
  priceKey: string;
  name: string;
  sku: string | null;
  unit: string;
  packHint?: PackHint;
  quantity: number;
  /** Quantity received at the door (delivery check-in), when recorded. */
  receivedQty: number | null;
  /** Agreed price per `unit` at order time. */
  unitPrice: number;
  /** Product VAT rate when known (marketplace products). */
  vatRate: number | null;
}

export interface CandidateOrder {
  id: string;
  /** YYYY-MM-DD order creation date. */
  date: string;
  deliveryDate: string | null;
  /** DDT numbers known for the order (supplier DDT documents, check-in). */
  ddtNumbers: string[];
  lines: CandidateOrderLine[];
}

export interface PriceListEntry {
  priceKey: string;
  productId: string | null;
  name: string;
  sku: string | null;
  unit: string;
  packHint?: PackHint;
  price: number;
  source: "catalog" | "listino";
}

export interface ExistingInvoiceRef {
  id: string;
  supplierVat: string | null;
  documentType: string;
  number: string;
  date: string | null;
  gross: number;
}

export interface ReconcileInput {
  invoice: ParsedInvoice;
  supplierKnown: boolean;
  orders: CandidateOrder[];
  priceList: PriceListEntry[];
  existing: ExistingInvoiceRef[];
  /** Order line refs already reconciled by other invoices (not credit notes). */
  alreadyInvoiced?: Set<string>;
  /** Whether delivery check-in data was available for the candidate orders. */
  receivingAvailable: boolean;
  /** Fallback key prefix for unmatched lines (e.g. "i:<vat>"). */
  fallbackKeyPrefix: string;
}

/* ------------------------------------------------------------------ */
/* Outputs                                                              */
/* ------------------------------------------------------------------ */

export interface LineMatch {
  lineNumber: number;
  kind: ParsedInvoiceLine["kind"];
  orderLineRef: string | null;
  orderId: string | null;
  productId: string | null;
  priceKey: string;
  score: number;
  /** Agreed price expressed per invoice unit, when comparable. */
  agreedUnitPrice: number | null;
  agreedSource: "order" | "catalog" | "listino" | null;
  /** Effective price per invoice unit after line + document discounts. */
  effectiveUnitPrice: number | null;
  orderedQty: number | null;
  receivedQty: number | null;
  /** Quantities expressed in the invoice unit (when comparable). */
  quantitySource: "received" | "ordered" | null;
  dimension: Dimension | null;
  note: string | null;
}

export interface ReconcileResult {
  orderIds: string[];
  method: "ddt" | "date_window" | "price_list" | "none";
  confidence: number;
  lines: LineMatch[];
  findings: Finding[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function priceKeyForProduct(productId: string): string {
  return `p:${productId}`;
}

export function priceKeyForCatalog(catalogId: string, name: string): string {
  return `c:${catalogId}:${productKeyName(name)}`;
}

export function priceKeyForInvoice(prefix: string, description: string): string {
  return `${prefix}:${productKeyName(description)}`;
}

/** "DDT 0123/2026", "123-A", "n. 123" → "123A" (digits + letters, no zeros pad). */
export function normalizeDdtNumber(raw: string): string {
  const s = raw.toUpperCase().replace(/^\s*(DDT|D\.D\.T\.|BOLLA|DOC|N\.?|NR\.?|NUM\.?)\s*/g, "");
  const main = s.split(/[/\\]/)[0] ?? s;
  return main.replace(/[^A-Z0-9]/g, "").replace(/^0+(?=\d)/, "");
}

const cents = (eur: number) => Math.round(eur * 100);
const round4 = (n: number) => Math.round(n * 10000) / 10000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function severityFor(impactEur: number, pct: number | null): FindingSeverity {
  if (impactEur >= 25 || (pct !== null && pct >= 10 && impactEur >= 5)) return "high";
  if (impactEur >= 5 || (pct !== null && pct >= 3 && impactEur >= 1)) return "medium";
  return "low";
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtQty = (n: number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);

/** Tolerance on quantities: catch-weight goods vary at the scale. */
function qtyTolerance(d: Dimension): number {
  return d === "kg" || d === "l" ? 0.03 : 0.0001;
}

interface Pairing {
  line: ParsedInvoiceLine;
  target: CandidateOrderLine;
  order: CandidateOrder;
  score: number;
}

function lineScore(line: ParsedInvoiceLine, target: { name: string; sku: string | null; unit: string; packHint?: PackHint }): number {
  const codes = line.itemCodes.map((c) => normalizeCode(c.value)).filter(Boolean) as string[];
  const sku = normalizeCode(target.sku);
  const codeHit = sku !== null && codes.includes(sku);
  const nameSim = productSimilarity(line.description, target.name);
  let score = codeHit ? Math.max(0.92, nameSim) : nameSim;
  const billed = measureOf(line.quantity ?? 1, line.unit, line.description);
  const ordered = measureOf(1, target.unit, target.name, target.packHint);
  if (!commonDimension(billed, ordered)) score *= 0.85;
  return score;
}

const MIN_SCORE = 0.5;
const SPLIT_SCORE = 0.75;

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

export function reconcileInvoice(input: ReconcileInput): ReconcileResult {
  const { invoice } = input;
  const findings: Finding[] = [];
  const isCredit = CREDIT_NOTE_TYPES.has(invoice.documentType);
  const goods = invoice.lines.filter((l) => l.kind === "goods" || l.kind === "accessory");

  /* --- Duplicates ------------------------------------------------- */
  findings.push(...duplicateFindings(invoice, input.existing));

  /* --- Document totals -------------------------------------------- */
  const tm = totalMismatch(invoice);
  if (tm) findings.push(tm);

  /* Credit notes: only duplicates/totals; matching handled by credit-notes.ts */
  if (isCredit) {
    return {
      orderIds: [],
      method: "none",
      confidence: 0,
      lines: invoice.lines.map((l) => emptyMatch(l, priceKeyForInvoice(input.fallbackKeyPrefix, l.description))),
      findings,
    };
  }

  /* --- Document-level discount factor (SC lines, global sconto) ---- */
  const goodsTotal = goods.filter((l) => l.kind === "goods").reduce((s, l) => s + l.totalPrice, 0);
  const discountTotal = invoice.lines
    .filter((l) => l.kind === "discount" || l.kind === "allowance")
    .reduce((s, l) => s - Math.abs(l.totalPrice), 0);
  const docFactor = goodsTotal > 0 ? Math.max(0, (goodsTotal + discountTotal) / goodsTotal) : 1;
  const globalFactor = invoice.globalDiscounts.length > 0 ? applyDiscounts(1, invoice.globalDiscounts) : 1;
  const priceFactor = docFactor * globalFactor;

  /* --- Order selection -------------------------------------------- */
  const already = input.alreadyInvoiced ?? new Set<string>();
  let method: ReconcileResult["method"] = "none";
  let candidates: CandidateOrder[] = [];
  const invDate = invoice.date ?? new Date().toISOString().slice(0, 10);

  const ddtNums = new Set(invoice.ddt.map((d) => normalizeDdtNumber(d.number)).filter(Boolean));
  if (ddtNums.size > 0) {
    candidates = input.orders.filter((o) => o.ddtNumbers.some((n) => ddtNums.has(normalizeDdtNumber(n))));
    if (candidates.length > 0) method = "ddt";
  }
  if (candidates.length === 0) {
    candidates = input.orders.filter((o) => {
      const delta = daysBetween(invDate, o.deliveryDate ?? o.date);
      return delta >= -5 && delta <= 62;
    });
    if (candidates.length > 0) method = "date_window";
  }

  /* --- Line pairing ------------------------------------------------ */
  const pairs: Pairing[] = [];
  for (const line of goods) {
    for (const order of candidates) {
      const ddtLimited = ddtLineOrders(invoice, line.lineNumber, input.orders);
      if (ddtLimited && !ddtLimited.has(order.id)) continue;
      const proximity = 1 - Math.min(1, Math.abs(daysBetween(invDate, order.deliveryDate ?? order.date)) / 62);
      for (const target of order.lines) {
        let score = lineScore(line, target);
        if (score < MIN_SCORE * 0.9) continue;
        if (method === "date_window" && already.has(target.ref)) score *= 0.8;
        score += 0.03 * proximity;
        pairs.push({ line, target, order, score });
      }
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const byLine = new Map<number, Pairing>();
  const usedTargets = new Set<string>();
  for (const p of pairs) {
    if (p.score < MIN_SCORE) break;
    if (byLine.has(p.line.lineNumber) || usedTargets.has(p.target.ref)) continue;
    byLine.set(p.line.lineNumber, p);
    usedTargets.add(p.target.ref);
  }
  // Second pass: the same order line billed over several invoice lines.
  for (const p of pairs) {
    if (p.score < SPLIT_SCORE) break;
    if (!byLine.has(p.line.lineNumber)) byLine.set(p.line.lineNumber, p);
  }

  // Orders kept = those that contributed at least one line.
  const orderIds = [...new Set([...byLine.values()].map((p) => p.order.id))];
  if (orderIds.length === 0 && method !== "none") method = "none";

  /* --- Per-line checks --------------------------------------------- */
  const lines: LineMatch[] = [];
  const billedByTarget = new Map<string, { measure: Measure; lines: ParsedInvoiceLine[]; effPrice: number; pairing: Pairing }>();

  for (const line of invoice.lines) {
    const fallbackKey = priceKeyForInvoice(input.fallbackKeyPrefix, line.description);
    if (line.kind !== "goods" && line.kind !== "accessory") {
      lines.push(emptyMatch(line, fallbackKey));
      continue;
    }
    const qty = line.quantity ?? 1;
    const effective = qty !== 0 ? (line.totalPrice / qty) * priceFactor : null;
    const p = byLine.get(line.lineNumber);

    if (p) {
      const t = p.target;
      const billed = measureOf(qty, line.unit, line.description);
      const agreedPer = measureOf(1, t.unit, t.name, t.packHint);
      const dim = commonDimension(billed, agreedPer);
      const m: LineMatch = {
        lineNumber: line.lineNumber,
        kind: line.kind,
        orderLineRef: t.ref,
        orderId: t.orderId,
        productId: t.productId,
        priceKey: t.priceKey,
        score: round4(p.score),
        agreedUnitPrice: null,
        agreedSource: "order",
        effectiveUnitPrice: effective !== null ? round4(effective) : null,
        orderedQty: null,
        receivedQty: null,
        quantitySource: null,
        dimension: dim,
        note: null,
      };
      if (dim && effective !== null) {
        const billedQty = measureValue(billed, dim)!;
        const perAgreed = measureValue(agreedPer, dim)!;
        // € per dimension unit, agreed vs billed.
        const agreedPerDim = t.unitPrice / perAgreed;
        const billedPerDim = (line.totalPrice * priceFactor) / billedQty;
        const invoicePerDimFactor = billedQty / qty; // dimension units per invoice unit
        m.agreedUnitPrice = round4(agreedPerDim * invoicePerDimFactor);
        const orderedDim = measureValue(measureOf(t.quantity, t.unit, t.name, t.packHint), dim);
        m.orderedQty = orderedDim !== null ? round4(orderedDim / invoicePerDimFactor) : null;
        if (t.receivedQty !== null) {
          const recDim = measureValue(measureOf(t.receivedQty, t.unit, t.name, t.packHint), dim);
          m.receivedQty = recDim !== null ? round4(recDim / invoicePerDimFactor) : null;
        }
        m.quantitySource = m.receivedQty !== null ? "received" : m.orderedQty !== null ? "ordered" : null;

        const diff = billedPerDim - agreedPerDim;
        const pct = agreedPerDim > 0 ? (diff / agreedPerDim) * 100 : null;
        const impact = diff * billedQty;
        if (agreedPerDim > 0 && pct !== null && pct > 0.5 && impact >= 0.05) {
          findings.push({
            kind: "price_above_agreed",
            severity: severityFor(impact, pct),
            impactCents: cents(impact),
            recoverable: true,
            lineNumber: line.lineNumber,
            title: `Prezzo più alto dell'ordine: ${line.description}`,
            message: `Fatturato ${fmtEur(billedPerDim)}/${dimLabel(dim, billed)} invece di ${fmtEur(agreedPerDim)}/${dimLabel(dim, billed)} (+${pct.toFixed(1).replace(".", ",")}%) su ${fmtQty(billedQty)} ${dimLabel(dim, billed)}: ${fmtEur(impact)} in più.`,
            details: {
              billedUnitPrice: round4(billedPerDim),
              agreedUnitPrice: round4(agreedPerDim),
              dimension: dim,
              quantity: round4(billedQty),
              pct: Math.round(pct * 10) / 10,
              orderId: t.orderId,
              orderLineRef: t.ref,
              agreedSource: "order",
            },
          });
        }
        const agg = billedByTarget.get(t.ref);
        if (agg) {
          agg.measure = addMeasure(agg.measure, billed);
          agg.lines.push(line);
        } else {
          billedByTarget.set(t.ref, { measure: billed, lines: [line], effPrice: billedPerDim, pairing: p });
        }
      } else if (!dim) {
        m.note = "Unità di misura non confrontabili: controlla a mano";
      }
      lines.push(m);
      continue;
    }

    // Not matched to any order line.
    const listHit = bestPriceListMatch(line, input.priceList);
    const m: LineMatch = {
      ...emptyMatch(line, listHit ? listHit.entry.priceKey : fallbackKey),
      productId: listHit?.entry.productId ?? null,
      score: listHit ? round4(listHit.score) : 0,
      effectiveUnitPrice: effective !== null ? round4(effective) : null,
    };
    if (listHit && effective !== null) {
      const billed = measureOf(qty, line.unit, line.description);
      const per = measureOf(1, listHit.entry.unit, listHit.entry.name, listHit.entry.packHint);
      const dim = commonDimension(billed, per);
      m.dimension = dim;
      m.agreedSource = listHit.entry.source;
      if (dim) {
        const billedQty = measureValue(billed, dim)!;
        const agreedPerDim = listHit.entry.price / measureValue(per, dim)!;
        const billedPerDim = (line.totalPrice * priceFactor) / billedQty;
        m.agreedUnitPrice = round4(agreedPerDim * (billedQty / qty));
        const diff = billedPerDim - agreedPerDim;
        const pct = agreedPerDim > 0 ? (diff / agreedPerDim) * 100 : null;
        const impact = diff * billedQty;
        if (agreedPerDim > 0 && pct !== null && pct > 0.5 && impact >= 0.05) {
          findings.push({
            kind: "price_above_agreed",
            severity: severityFor(impact, pct),
            impactCents: cents(impact),
            recoverable: true,
            lineNumber: line.lineNumber,
            title: `Prezzo più alto del listino: ${line.description}`,
            message: `Fatturato ${fmtEur(billedPerDim)}/${dimLabel(dim, billed)} contro ${fmtEur(agreedPerDim)} del ${listHit.entry.source === "catalog" ? "tuo catalogo" : "listino del fornitore"} (+${pct.toFixed(1).replace(".", ",")}%): ${fmtEur(impact)} in più.`,
            details: {
              billedUnitPrice: round4(billedPerDim),
              agreedUnitPrice: round4(agreedPerDim),
              dimension: dim,
              quantity: round4(billedQty),
              pct: Math.round(pct * 10) / 10,
              agreedSource: listHit.entry.source,
            },
          });
        }
      }
    }
    if (orderIds.length > 0 && line.totalPrice > 0) {
      const impact = line.totalPrice * priceFactor;
      const accessory = line.kind === "accessory";
      findings.push({
        kind: "not_ordered",
        severity: accessory ? "low" : severityFor(impact, null),
        impactCents: cents(impact),
        recoverable: !accessory,
        lineNumber: line.lineNumber,
        title: accessory ? `Addebito non presente nell'ordine: ${line.description}` : `Articolo fatturato ma non ordinato: ${line.description}`,
        message: accessory
          ? `Spesa accessoria di ${fmtEur(impact)} non prevista negli ordini collegati: verifica se era concordata.`
          : `${line.quantity !== null ? `${fmtQty(line.quantity)} ${line.unit ?? ""} ` : ""}per ${fmtEur(impact)} non trovati negli ordini collegati.`,
        details: { amount: Math.round(impact * 100) / 100 },
      });
    }
    lines.push(m);
  }

  /* --- Quantity checks (aggregated per order line) ------------------ */
  for (const [, agg] of billedByTarget) {
    const t = agg.pairing.target;
    const perUnit = measureOf(1, t.unit, t.name, t.packHint);
    const dim = commonDimension(agg.measure, perUnit);
    if (!dim) continue;
    const billedQty = measureValue(agg.measure, dim);
    const refRaw = t.receivedQty ?? t.quantity;
    const refQty = measureValue(measureOf(refRaw, t.unit, t.name, t.packHint), dim);
    if (billedQty === null || refQty === null) continue;
    const excess = billedQty - refQty;
    if (excess <= refQty * qtyTolerance(dim) || excess <= 1e-6) continue;
    const impact = excess * agg.effPrice;
    if (impact < 0.05) continue;
    const received = t.receivedQty !== null;
    const unitLabel = dimLabel(dim, agg.measure);
    findings.push({
      kind: received ? "qty_above_received" : "qty_above_ordered",
      severity: severityFor(impact, refQty > 0 ? (excess / refQty) * 100 : null),
      impactCents: cents(impact),
      recoverable: true,
      lineNumber: agg.lines[0]!.lineNumber,
      title: received
        ? `Quantità fatturata maggiore di quella ricevuta: ${t.name}`
        : `Quantità fatturata maggiore di quella ordinata: ${t.name}`,
      message: `Fatturati ${fmtQty(billedQty)} ${unitLabel}, ${received ? "ricevuti" : "ordinati"} ${fmtQty(refQty)} ${unitLabel}: ${fmtQty(excess)} ${unitLabel} in più (${fmtEur(impact)}).${received ? "" : " Confronto con l'ordinato: nessun controllo merce registrato."}`,
      details: {
        billed: round4(billedQty),
        reference: round4(refQty),
        referenceSource: received ? "received" : "ordered",
        dimension: dim,
        unitPrice: round4(agg.effPrice),
        orderId: t.orderId,
        orderLineRef: t.ref,
        invoiceLines: agg.lines.map((l) => l.lineNumber),
      },
    });
  }

  /* --- VAT ----------------------------------------------------------- */
  for (const line of goods) {
    if (line.totalPrice <= 0) continue;
    const p = byLine.get(line.lineNumber);
    const productRate = p?.target.vatRate ?? null;
    let expected: number[] | null = null;
    let label = "";
    if (productRate !== null && productRate > 0 && !line.natura) {
      if (Math.abs(productRate - line.vatRate) >= 0.01) {
        expected = [productRate];
        label = "aliquota del prodotto a listino";
      }
    } else {
      const check = checkVatRate(line.description, line.vatRate, line.natura);
      if (check) {
        expected = check.expected;
        label = `categoria "${check.category.label}"`;
      }
    }
    if (!expected) continue;
    const nearest = expected.reduce((a, b) => (Math.abs(b - line.vatRate) < Math.abs(a - line.vatRate) ? b : a));
    const vatDiff = Math.abs(line.vatRate - nearest) * line.totalPrice / 100;
    findings.push({
      kind: "vat_anomaly",
      severity: vatDiff >= 10 ? "medium" : "low",
      impactCents: cents(vatDiff),
      recoverable: false,
      lineNumber: line.lineNumber,
      title: `Aliquota IVA insolita: ${line.description}`,
      message: `IVA al ${fmtPct(line.vatRate)} ma per la ${label} ci si aspetta ${expected.map(fmtPct).join(" o ")} (differenza ${fmtEur(vatDiff)}). Da verificare con il commercialista.`,
      details: { billedRate: line.vatRate, expectedRates: expected },
    });
  }

  /* --- No order found ------------------------------------------------ */
  if (orderIds.length === 0 && goods.length > 0) {
    findings.push({
      kind: input.supplierKnown ? "no_order_found" : "unknown_supplier",
      severity: "low",
      impactCents: 0,
      recoverable: false,
      lineNumber: null,
      title: input.supplierKnown ? "Nessun ordine collegato" : "Fornitore non collegato",
      message: input.supplierKnown
        ? "Non ho trovato ordini o DDT corrispondenti: i prezzi sono confrontati con il catalogo quando possibile."
        : `Il fornitore ${invoice.supplier.name ?? ""} (P.IVA ${invoice.supplier.vatNumber ?? "—"}) non è collegato a un tuo fornitore o catalogo.`,
      details: {},
    });
  }

  const matchedCount = byLine.size;
  const confidence = goods.length > 0 ? round4(matchedCount / goods.length) : 0;
  return {
    orderIds,
    method: orderIds.length > 0 ? method : lines.some((l) => l.agreedSource === "catalog" || l.agreedSource === "listino") ? "price_list" : "none",
    confidence,
    lines,
    findings,
  };
}

function fmtPct(n: number): string {
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(n)}%`;
}

function dimLabel(d: Dimension, m: Measure): string {
  if (d === "pack") return m.pack?.code ?? "conf.";
  return d;
}

function addMeasure(a: Measure, b: Measure): Measure {
  const out: Measure = {};
  for (const k of ["kg", "l", "pz"] as const) {
    if (a[k] !== undefined && b[k] !== undefined) out[k] = a[k]! + b[k]!;
  }
  if (a.pack && b.pack && a.pack.code === b.pack.code) out.pack = { code: a.pack.code, qty: a.pack.qty + b.pack.qty };
  return out;
}

function emptyMatch(line: ParsedInvoiceLine, priceKey: string): LineMatch {
  return {
    lineNumber: line.lineNumber,
    kind: line.kind,
    orderLineRef: null,
    orderId: null,
    productId: null,
    priceKey,
    score: 0,
    agreedUnitPrice: null,
    agreedSource: null,
    effectiveUnitPrice: null,
    orderedQty: null,
    receivedQty: null,
    quantitySource: null,
    dimension: null,
    note: null,
  };
}

/** Orders allowed for a line through DatiDDT.RiferimentoNumeroLinea, if any. */
function ddtLineOrders(invoice: ParsedInvoice, lineNumber: number, orders: CandidateOrder[]): Set<string> | null {
  const refs = invoice.ddt.filter((d) => d.lineNumbers.includes(lineNumber));
  if (refs.length === 0) return null;
  const nums = new Set(refs.map((r) => normalizeDdtNumber(r.number)));
  const ids = orders.filter((o) => o.ddtNumbers.some((n) => nums.has(normalizeDdtNumber(n)))).map((o) => o.id);
  return ids.length > 0 ? new Set(ids) : null;
}

function bestPriceListMatch(line: ParsedInvoiceLine, list: PriceListEntry[]): { entry: PriceListEntry; score: number } | null {
  let best: { entry: PriceListEntry; score: number } | null = null;
  for (const entry of list) {
    const score = lineScore(line, entry);
    if (score >= 0.6 && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

function duplicateFindings(invoice: ParsedInvoice, existing: ExistingInvoiceRef[]): Finding[] {
  const out: Finding[] = [];
  const vat = normalizeVat(invoice.supplier.vatNumber);
  const year = invoice.date?.slice(0, 4) ?? null;
  const num = invoice.number.trim().toUpperCase().replace(/\s+/g, "");
  const exact = existing.find(
    (e) =>
      e.supplierVat === vat &&
      e.documentType === invoice.documentType &&
      e.number.trim().toUpperCase().replace(/\s+/g, "") === num &&
      (e.date?.slice(0, 4) ?? null) === year,
  );
  if (exact) {
    out.push({
      kind: "duplicate_invoice",
      severity: "high",
      impactCents: cents(invoice.totals.taxable),
      recoverable: true,
      lineNumber: null,
      title: "Fattura duplicata",
      message: `Esiste già la fattura n. ${invoice.number} di questo fornitore per lo stesso anno: non pagarla due volte.`,
      details: { duplicateOf: exact.id },
    });
    return out;
  }
  const near = existing.find(
    (e) =>
      e.supplierVat === vat &&
      e.documentType === invoice.documentType &&
      e.date === invoice.date &&
      Math.abs(e.gross - invoice.totals.gross) < 0.01 &&
      invoice.totals.gross > 0,
  );
  if (near) {
    out.push({
      kind: "possible_duplicate",
      severity: "medium",
      impactCents: cents(invoice.totals.taxable),
      recoverable: false,
      lineNumber: null,
      title: "Possibile duplicato",
      message: `Stesso fornitore, stessa data e stesso importo della fattura n. ${near.number}: controlla che non sia lo stesso addebito.`,
      details: { similarTo: near.id },
    });
  }
  return out;
}

function totalMismatch(invoice: ParsedInvoice): Finding | null {
  if (invoice.totalAmount === null || invoice.vatSummaries.length === 0) return null;
  const expected = invoice.totals.taxable + invoice.totals.vat + (invoice.stampDuty ?? 0) + (invoice.rounding ?? 0);
  const diff = invoice.totalAmount - expected;
  // Bollo virtuale is often not included in ImportoTotaleDocumento: accept both.
  const diffNoStamp = invoice.totalAmount - (expected - (invoice.stampDuty ?? 0));
  if (Math.abs(diff) <= 0.05 || Math.abs(diffNoStamp) <= 0.05) return null;
  return {
    kind: "total_mismatch",
    severity: Math.abs(diff) >= 5 ? "medium" : "low",
    impactCents: diff > 0 ? cents(diff) : 0,
    recoverable: diff > 0,
    lineNumber: null,
    title: "Totale documento incoerente",
    message: `Il totale dichiarato (${fmtEur(invoice.totalAmount)}) non corrisponde a imponibile + IVA (${fmtEur(expected)}): differenza ${fmtEur(diff)}.`,
    details: { declared: invoice.totalAmount, computed: Math.round(expected * 100) / 100 },
  };
}
