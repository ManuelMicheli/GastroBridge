// lib/invoices/fatturapa.ts
// FatturaPA parser — tracciato 1.2.x ordinario (FPR12 privati, FPA12 PA) and,
// minimally, the semplificata (FSM10).
//
// Robust to: namespace prefixes (p:, ns2:, none), BOM / encodings (see
// decode.ts), multiple <FatturaElettronicaBody> per file (lotto di fatture),
// comma decimal separators written by non-compliant software, missing
// optional blocks. Also accepts the snake_case JSON rendering used by some SDI
// intermediaries (see jsonToElement in xml.ts).

import {
  child,
  children,
  findFirst,
  parseXml,
  textAt,
  type XmlElement,
} from "./xml.ts";
import type {
  DdtRef,
  DocumentRef,
  InvoiceAddress,
  InvoiceAttachmentInfo,
  InvoiceLineKind,
  InvoiceParty,
  LineDiscount,
  ParsedInvoice,
  ParsedInvoiceLine,
  ParseResult,
  PaymentInstallment,
  VatSummary,
} from "./types.ts";

/* ------------------------------------------------------------------ */
/* Labels                                                               */
/* ------------------------------------------------------------------ */

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  TD03: "Acconto/anticipo su parcella",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD06: "Parcella",
  TD07: "Fattura semplificata",
  TD08: "Nota di credito semplificata",
  TD09: "Nota di debito semplificata",
  TD16: "Integrazione reverse charge interno",
  TD17: "Integrazione/autofattura servizi dall'estero",
  TD18: "Integrazione acquisto beni intracomunitari",
  TD19: "Integrazione/autofattura beni ex art.17 c.2",
  TD20: "Autofattura/regolarizzazione",
  TD21: "Autofattura per splafonamento",
  TD22: "Estrazione beni da deposito IVA",
  TD23: "Estrazione beni da deposito IVA con versamento",
  TD24: "Fattura differita (art. 21 c.4 lett. a)",
  TD25: "Fattura differita (art. 21 c.4 lett. b)",
  TD26: "Cessione beni ammortizzabili / passaggi interni",
  TD27: "Autoconsumo / cessioni gratuite",
  TD28: "Acquisti da San Marino con IVA",
  TD29: "Comunicazione omessa o irregolare fatturazione",
};

export const CREDIT_NOTE_TYPES = new Set(["TD04", "TD08"]);

export function documentTypeLabel(code: string): string {
  return DOCUMENT_TYPE_LABELS[code] ?? code;
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP03: "Assegno circolare",
  MP04: "Contanti presso Tesoreria",
  MP05: "Bonifico",
  MP06: "Vaglia cambiario",
  MP07: "Bollettino bancario",
  MP08: "Carta di pagamento",
  MP09: "RID",
  MP10: "RID utenze",
  MP11: "RID veloce",
  MP12: "RIBA",
  MP13: "MAV",
  MP14: "Quietanza erario",
  MP15: "Giroconto",
  MP16: "Domiciliazione bancaria",
  MP17: "Domiciliazione postale",
  MP18: "Bollettino postale",
  MP19: "SEPA Direct Debit",
  MP20: "SEPA Direct Debit CORE",
  MP21: "SEPA Direct Debit B2B",
  MP22: "Trattenuta su somme già riscosse",
  MP23: "PagoPA",
};

export function paymentMethodLabel(code: string | null): string {
  if (!code) return "—";
  return PAYMENT_METHOD_LABELS[code] ?? code;
}

/* ------------------------------------------------------------------ */
/* Scalars                                                              */
/* ------------------------------------------------------------------ */

/** Parse a FatturaPA decimal ("1234.56"); tolerates "1.234,56" and "12,5". */
export function parseDecimal(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/\s+/g, "").replace(/€/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function num(el: XmlElement | null | undefined, ...names: string[]): number | null {
  return parseDecimal(textAt(el, ...names));
}

/** Normalise dates to YYYY-MM-DD (accepts ISO with time and dd/mm/yyyy). */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return null;
}

function date(el: XmlElement | null | undefined, ...names: string[]): string | null {
  return parseDate(textAt(el, ...names));
}

function intList(els: XmlElement[]): number[] {
  return els
    .map((e) => parseInt(e.text.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Normalise a P.IVA: strip country prefix, spaces and punctuation. */
export function normalizeVat(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.toUpperCase().replace(/[\s.\-/]/g, "");
  if (/^[A-Z]{2}\d/.test(s)) s = s.slice(2);
  return s.length > 0 ? s : null;
}

/* ------------------------------------------------------------------ */
/* Blocks                                                               */
/* ------------------------------------------------------------------ */

function parseAddress(el: XmlElement | null): InvoiceAddress | null {
  if (!el) return null;
  return {
    street: textAt(el, "Indirizzo"),
    number: textAt(el, "NumeroCivico"),
    zip: textAt(el, "CAP"),
    city: textAt(el, "Comune"),
    province: textAt(el, "Provincia"),
    country: textAt(el, "Nazione"),
  };
}

function partyName(anagrafica: XmlElement | null): string | null {
  if (!anagrafica) return null;
  const den = textAt(anagrafica, "Denominazione");
  if (den) return den;
  const parts = [textAt(anagrafica, "Titolo"), textAt(anagrafica, "Nome"), textAt(anagrafica, "Cognome")].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function parseParty(el: XmlElement | null): InvoiceParty {
  const anag = child(el, "DatiAnagrafici");
  // Semplificata: fields sit directly under the party / IdentificativiFiscali.
  const ids = child(el, "IdentificativiFiscali") ?? anag ?? el;
  const idIva = child(ids, "IdFiscaleIVA");
  return {
    vatCountry: textAt(idIva, "IdPaese"),
    vatNumber: normalizeVat(textAt(idIva, "IdCodice")),
    taxCode: textAt(ids, "CodiceFiscale"),
    name: partyName(child(anag, "Anagrafica")) ?? partyName(child(el, "AltriDatiIdentificativi")) ?? partyName(el),
    address: parseAddress(child(el, "Sede") ?? child(child(el, "AltriDatiIdentificativi"), "Sede")),
    email: textAt(el, "Contatti", "Email"),
    phone: textAt(el, "Contatti", "Telefono"),
    regime: textAt(anag, "RegimeFiscale") ?? textAt(el, "RegimeFiscale"),
  };
}

function parseDiscounts(el: XmlElement | null): LineDiscount[] {
  return children(el, "ScontoMaggiorazione").map((d) => ({
    type: (textAt(d, "Tipo") ?? "SC").toUpperCase() === "MG" ? "MG" : "SC",
    percent: num(d, "Percentuale"),
    amount: num(d, "Importo"),
  }));
}

function parseDocRefs(general: XmlElement | null, name: string): DocumentRef[] {
  return children(general, name).map((r) => ({
    id: textAt(r, "IdDocumento"),
    date: date(r, "Data"),
    lineNumbers: intList(children(r, "RiferimentoNumeroLinea")),
  }));
}

function lineKind(saleType: string | null, quantity: number | null, unitPrice: number, total: number): InvoiceLineKind {
  switch ((saleType ?? "").toUpperCase()) {
    case "SC":
      return "discount";
    case "PR":
      return "premium";
    case "AB":
      return "allowance";
    case "AC":
      return "accessory";
  }
  if (quantity === null && unitPrice === 0 && total === 0) return "note";
  if (total < 0 || unitPrice < 0) return "discount";
  return "goods";
}

function parseLine(el: XmlElement, index: number, warnings: string[]): ParsedInvoiceLine {
  const lineNumber = parseInt(textAt(el, "NumeroLinea") ?? "", 10) || index + 1;
  const quantity = num(el, "Quantita");
  const unitPrice = num(el, "PrezzoUnitario") ?? 0;
  let totalPrice = num(el, "PrezzoTotale");
  const discounts = parseDiscounts(el);
  if (totalPrice === null) {
    totalPrice = round2(applyDiscounts(unitPrice, discounts) * (quantity ?? 1));
    warnings.push(`Riga ${lineNumber}: PrezzoTotale mancante, calcolato`);
  }
  const saleType = textAt(el, "TipoCessionePrestazione");
  return {
    lineNumber,
    kind: lineKind(saleType, quantity, unitPrice, totalPrice),
    saleType,
    itemCodes: children(el, "CodiceArticolo")
      .map((c) => ({ type: textAt(c, "CodiceTipo") ?? "", value: textAt(c, "CodiceValore") ?? "" }))
      .filter((c) => c.value.length > 0),
    description: textAt(el, "Descrizione") ?? "",
    quantity,
    unit: textAt(el, "UnitaMisura"),
    unitPrice,
    discounts,
    totalPrice,
    vatRate: num(el, "AliquotaIVA") ?? 0,
    natura: textAt(el, "Natura"),
    periodStart: date(el, "DataInizioPeriodo"),
    periodEnd: date(el, "DataFinePeriodo"),
    otherData: children(el, "AltriDatiGestionali").map((a) => ({
      type: textAt(a, "TipoDato"),
      text: textAt(a, "RiferimentoTesto"),
      number: num(a, "RiferimentoNumero"),
      date: date(a, "RiferimentoData"),
    })),
  };
}

/** Unit price after a chain of SC/MG discounts (percent and/or amount). */
export function applyDiscounts(unitPrice: number, discounts: LineDiscount[]): number {
  let p = unitPrice;
  for (const d of discounts) {
    const sign = d.type === "MG" ? 1 : -1;
    if (d.percent !== null) p = p * (1 + (sign * d.percent) / 100);
    else if (d.amount !== null) p = p + sign * d.amount;
  }
  return p;
}

function parsePayments(body: XmlElement): PaymentInstallment[] {
  const out: PaymentInstallment[] = [];
  for (const dp of children(body, "DatiPagamento")) {
    const conditions = textAt(dp, "CondizioniPagamento");
    for (const det of children(dp, "DettaglioPagamento")) {
      let dueDate = date(det, "DataScadenzaPagamento");
      if (!dueDate) {
        const ref = date(det, "DataRiferimentoTerminiPagamento");
        const days = parseInt(textAt(det, "GiorniTerminiPagamento") ?? "", 10);
        if (ref && Number.isFinite(days)) dueDate = addDays(ref, days);
      }
      out.push({
        conditions,
        method: textAt(det, "ModalitaPagamento"),
        dueDate,
        amount: num(det, "ImportoPagamento"),
        iban: textAt(det, "IBAN"),
        beneficiary: textAt(det, "Beneficiario"),
        bank: textAt(det, "IstitutoFinanziario"),
      });
    }
  }
  return out;
}

function parseAttachments(body: XmlElement): InvoiceAttachmentInfo[] {
  return children(body, "Allegati").map((a) => {
    const raw = (child(a, "Attachment")?.text ?? "").replace(/\s+/g, "");
    return {
      name: textAt(a, "NomeAttachment"),
      format: textAt(a, "FormatoAttachment"),
      description: textAt(a, "DescrizioneAttachment"),
      sizeBytes: Math.floor((raw.length * 3) / 4),
    };
  });
}

function parseOrdinaryBody(
  body: XmlElement,
  bodyIndex: number,
  header: XmlElement | null,
  root: XmlElement,
): ParsedInvoice {
  const warnings: string[] = [];
  const general = child(body, "DatiGenerali");
  const doc = child(general, "DatiGeneraliDocumento");
  const goods = child(body, "DatiBeniServizi");

  const lines = children(goods, "DettaglioLinee").map((l, i) => parseLine(l, i, warnings));

  const vatSummaries: VatSummary[] = children(goods, "DatiRiepilogo").map((r) => ({
    rate: num(r, "AliquotaIVA") ?? 0,
    natura: textAt(r, "Natura"),
    taxable: num(r, "ImponibileImporto") ?? 0,
    tax: num(r, "Imposta") ?? 0,
    accessoryCharges: num(r, "SpeseAccessorie"),
    rounding: num(r, "Arrotondamento"),
    esigibilita: textAt(r, "EsigibilitaIVA"),
    normRef: textAt(r, "RiferimentoNormativo"),
  }));

  const ddt: DdtRef[] = children(general, "DatiDDT")
    .map((d) => ({
      number: textAt(d, "NumeroDDT") ?? "",
      date: date(d, "DataDDT"),
      lineNumbers: intList(children(d, "RiferimentoNumeroLinea")),
    }))
    .filter((d) => d.number.length > 0);

  const linesTotal = round2(lines.reduce((s, l) => s + l.totalPrice, 0));
  const taxable = vatSummaries.length > 0 ? round2(vatSummaries.reduce((s, v) => s + v.taxable, 0)) : linesTotal;
  const vat =
    vatSummaries.length > 0
      ? round2(vatSummaries.reduce((s, v) => s + v.tax, 0))
      : round2(lines.reduce((s, l) => s + (l.totalPrice * l.vatRate) / 100, 0));
  const totalAmount = num(doc, "ImportoTotaleDocumento");
  const stampDuty = num(doc, "DatiBollo", "ImportoBollo");
  const rounding = num(doc, "Arrotondamento");

  const number = textAt(doc, "Numero") ?? "";
  const documentType = (textAt(doc, "TipoDocumento") ?? "TD01").toUpperCase();
  if (!number) warnings.push("Numero documento mancante");
  if (!textAt(doc, "Data")) warnings.push("Data documento mancante");

  return {
    bodyIndex,
    formatVersion: root.attrs["versione"] ?? textAt(header, "DatiTrasmissione", "FormatoTrasmissione"),
    simplified: false,
    transmission: {
      senderId: [textAt(header, "DatiTrasmissione", "IdTrasmittente", "IdPaese"), textAt(header, "DatiTrasmissione", "IdTrasmittente", "IdCodice")]
        .filter(Boolean)
        .join("") || null,
      progressive: textAt(header, "DatiTrasmissione", "ProgressivoInvio"),
      recipientCode: textAt(header, "DatiTrasmissione", "CodiceDestinatario"),
      recipientPec: textAt(header, "DatiTrasmissione", "PECDestinatario"),
    },
    supplier: parseParty(child(header, "CedentePrestatore")),
    buyer: parseParty(child(header, "CessionarioCommittente")),
    documentType,
    currency: textAt(doc, "Divisa") ?? "EUR",
    date: date(doc, "Data"),
    number,
    totalAmount,
    rounding,
    stampDuty,
    causale: children(doc, "Causale").map((c) => c.text.trim()).filter(Boolean),
    globalDiscounts: parseDiscounts(doc),
    orderRefs: parseDocRefs(general, "DatiOrdineAcquisto"),
    linkedInvoices: parseDocRefs(general, "DatiFattureCollegate"),
    ddt,
    lines,
    vatSummaries,
    payments: parsePayments(body),
    attachments: parseAttachments(body),
    totals: {
      taxable,
      vat,
      gross: totalAmount ?? round2(taxable + vat + (stampDuty ?? 0) + (rounding ?? 0)),
      linesTotal,
    },
    warnings,
  };
}

function parseSimplifiedBody(body: XmlElement, bodyIndex: number, header: XmlElement | null, root: XmlElement): ParsedInvoice {
  const warnings: string[] = [];
  const general = child(body, "DatiGenerali");
  const doc = child(general, "DatiGeneraliDocumento");
  const lines: ParsedInvoiceLine[] = children(body, "DatiBeniServizi").map((b, i) => {
    const gross = num(b, "Importo") ?? 0;
    const rate = num(b, "DatiIVA", "Aliquota") ?? 0;
    const tax = num(b, "DatiIVA", "Imposta");
    const taxable = tax !== null ? round2(gross - tax) : round2(gross / (1 + rate / 100));
    return {
      lineNumber: i + 1,
      kind: "goods",
      saleType: null,
      itemCodes: [],
      description: textAt(b, "Descrizione") ?? "",
      quantity: null,
      unit: null,
      unitPrice: taxable,
      discounts: [],
      totalPrice: taxable,
      vatRate: rate,
      natura: textAt(b, "Natura"),
      periodStart: null,
      periodEnd: null,
      otherData: [],
    };
  });
  const linesTotal = round2(lines.reduce((s, l) => s + l.totalPrice, 0));
  const vat = round2(children(body, "DatiBeniServizi").reduce((s, b) => s + (num(b, "DatiIVA", "Imposta") ?? 0), 0));
  return {
    bodyIndex,
    formatVersion: root.attrs["versione"] ?? "FSM10",
    simplified: true,
    transmission: {
      senderId: null,
      progressive: textAt(header, "DatiTrasmissione", "ProgressivoInvio"),
      recipientCode: textAt(header, "DatiTrasmissione", "CodiceDestinatario"),
      recipientPec: textAt(header, "DatiTrasmissione", "PECDestinatario"),
    },
    supplier: parseParty(child(header, "CedentePrestatore")),
    buyer: parseParty(child(header, "CessionarioCommittente")),
    documentType: (textAt(doc, "TipoDocumento") ?? "TD07").toUpperCase(),
    currency: textAt(doc, "Divisa") ?? "EUR",
    date: date(doc, "Data"),
    number: textAt(doc, "Numero") ?? "",
    totalAmount: null,
    rounding: null,
    stampDuty: num(doc, "BolloVirtuale") ?? null,
    causale: [],
    globalDiscounts: [],
    orderRefs: [],
    linkedInvoices: parseDocRefs(general, "DatiFatturaRettificata"),
    ddt: [],
    lines,
    vatSummaries: [],
    payments: [],
    attachments: parseAttachments(body),
    totals: { taxable: linesTotal, vat, gross: round2(linesTotal + vat), linesTotal },
    warnings,
  };
}

/** Parse an already-built element tree (XML root or JSON rendering). */
export function parseFatturaElement(root: XmlElement): ParseResult {
  const errors: string[] = [];
  let rootEl = root;
  if (!child(rootEl, "FatturaElettronicaHeader")) {
    // JSON payloads / wrappers: look for the header deeper in the tree.
    const header = findFirst(root, "FatturaElettronicaHeader");
    if (!header) return { invoices: [], errors: ["Il documento non è una FatturaPA"] };
    rootEl = findParentOf(root, header) ?? root;
  }
  const header = child(rootEl, "FatturaElettronicaHeader");
  const bodies = children(rootEl, "FatturaElettronicaBody");
  if (!header) errors.push("FatturaElettronicaHeader mancante");
  if (bodies.length === 0) errors.push("Nessun FatturaElettronicaBody");
  const simplified = /semplificata/i.test(rootEl.name) || /^FSM/i.test(rootEl.attrs["versione"] ?? "");
  const invoices: ParsedInvoice[] = [];
  bodies.forEach((b, i) => {
    try {
      invoices.push(simplified ? parseSimplifiedBody(b, i, header, rootEl) : parseOrdinaryBody(b, i, header, rootEl));
    } catch (err) {
      errors.push(`Corpo ${i + 1}: ${err instanceof Error ? err.message : "errore"}`);
    }
  });
  return { invoices, errors };
}

function findParentOf(node: XmlElement, target: XmlElement): XmlElement | null {
  for (const c of node.children) {
    if (c === target) return node;
    const hit = findParentOf(c, target);
    if (hit) return hit;
  }
  return null;
}

/** Parse FatturaPA XML text into one invoice per body. */
export function parseFatturaPA(xml: string): ParseResult {
  let root: XmlElement;
  try {
    root = parseXml(xml);
  } catch (err) {
    return { invoices: [], errors: [`XML non valido: ${err instanceof Error ? err.message : "errore"}`] };
  }
  return parseFatturaElement(root);
}

/** Strip the base64 payload of <Attachment> elements (keeps stored XML lean). */
export function stripAttachments(xml: string): string {
  return xml.replace(
    /(<([A-Za-z0-9_]+:)?Attachment>)([\s\S]*?)(<\/([A-Za-z0-9_]+:)?Attachment>)/g,
    (_m, open: string, _p: string, content: string, close: string) =>
      content.length > 256 ? `${open}[allegato rimosso: ${Math.floor((content.replace(/\s+/g, "").length * 3) / 4)} byte]${close}` : `${open}${content}${close}`,
  );
}
