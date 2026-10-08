// Supplier details: P.IVA (with checksum), codice fiscale, contacts, address,
// delivery days, minimum order, cut-off time, lead time, company name.

import type { SupplierInfo } from "../types.ts";
import { fold } from "../text.ts";
import { parseNumber } from "./numbers.ts";

export function emptySupplier(): SupplierInfo {
  return {
    name: null,
    vatNumber: null,
    vatNumberValid: false,
    fiscalCode: null,
    emails: [],
    pec: null,
    phones: [],
    address: null,
    zip: null,
    city: null,
    province: null,
    deliveryDays: [],
    deliveryDaysText: null,
    minOrder: null,
    freeDeliveryOver: null,
    orderCutoff: null,
    leadTimeDays: null,
    website: null,
    notes: [],
    confidence: {},
  };
}

// ---------------------------------------------------------------------------
// P.IVA / codice fiscale
// ---------------------------------------------------------------------------

/** Italian VAT number checksum (Luhn variant on 11 digits). */
export function isValidPartitaIva(raw: string): boolean {
  const s = raw.replace(/^IT/i, "").replace(/\s/g, "");
  if (!/^\d{11}$/.test(s)) return false;
  if (/^0{11}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(s[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(s[10]);
}

const PIVA_LABELED =
  /(?:p\.?\s?\.?\s?iva|partita\s+iva|part\.?\s*iva|vat(?:\s*(?:no|n|number|id))?\.?|p\.\s?i\.|c\.?\s?f\.?\s*(?:e|\/)\s*p\.?\s?iva|codice\s+fiscale\s+e\s+partita\s+iva)\s*[:.n°#-]*\s*(?:it)?\s*(\d[\d\s]{9,13}\d)/i;
const CF_PERSON = /\b([A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z])\b/i;
const CF_LABELED = /(?:c\.?\s?f\.?|cod(?:ice)?\.?\s*fisc(?:ale)?\.?)\s*[:.]?\s*([A-Z0-9]{11,16})/i;

export function findVatNumber(text: string): { value: string; valid: boolean; labeled: boolean } | null {
  const m = PIVA_LABELED.exec(text);
  if (m) {
    const digits = m[1]!.replace(/\s/g, "");
    if (digits.length === 11) return { value: digits, valid: isValidPartitaIva(digits), labeled: true };
  }
  // Unlabeled 11-digit number with a valid checksum (rarely a coincidence).
  const re = /(?<![\d.,])(?:IT\s?)?(\d{11})(?![\d.,])/g;
  let u: RegExpExecArray | null;
  while ((u = re.exec(text))) {
    if (isValidPartitaIva(u[1]!)) return { value: u[1]!, valid: true, labeled: false };
  }
  return null;
}

export function findFiscalCode(text: string): string | null {
  const l = CF_LABELED.exec(text);
  if (l) return l[1]!.toUpperCase();
  const p = CF_PERSON.exec(text);
  return p ? p[1]!.toUpperCase() : null;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function findEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase().replace(/\.$/, "")))];
}

export function isPec(email: string, context = ""): boolean {
  return /(^|[.@])(pec|legalmail|postacert|pec\.it|arubapec|cert\.)/i.test(email) || /\bpec\b/i.test(context);
}

// Italian phones: +39 / 0039 prefix optional; landlines start with 0, mobiles with 3.
const PHONE_RE =
  /(?<![\d/])(?:(?:\+|00)\s?39[\s./-]?)?(?:0\d{1,3}[\s./-]?\d{2,4}[\s./-]?\d{2,4}(?:[\s./-]?\d{1,4})?|3\d{2}[\s./-]?\d{3,4}[\s./-]?\d{3,4})(?![\d,])/g;

export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("0039")) d = "+39" + d.slice(4);
  const national = d.replace(/^\+39/, "");
  if (!/^[03]\d{5,10}$/.test(national)) return null;
  if (national.length < 6 || national.length > 11) return null;
  // Format: mobile 3xx xxx xxxx
  if (national.startsWith("3")) {
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`.trim();
  }
  // Landline: keep the writer's grouping (area codes are 2–4 digits long).
  const groups = raw.replace(/^(?:\+|00)\s?39[\s./-]?/, "").split(/[\s./-]+/).filter(Boolean);
  if (groups.length >= 2 && groups.join("") === national) return groups.join(" ");
  const area = /^0[26]/.test(national) ? 2 : 3;
  return `${national.slice(0, area)} ${national.slice(area)}`;
}

const DATE_LIKE = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/;

export function findPhones(text: string, exclude: string[] = []): string[] {
  const out = new Set<string>();
  const ex = new Set(exclude.map((e) => e.replace(/\D/g, "")));
  for (const m of text.matchAll(PHONE_RE)) {
    const raw = m[0];
    if (DATE_LIKE.test(raw.trim())) continue;
    const digits = raw.replace(/\D/g, "").replace(/^(0039|39)(?=[03]\d{5})/, "");
    if (ex.has(digits)) continue;
    // 11 digits with valid VAT checksum and no separators → P.IVA, not a phone
    if (/^\d{11}$/.test(raw) && isValidPartitaIva(raw)) continue;
    // a date like 01/03/2024 is excluded by the regex; a CAP (5 digits) too short
    const n = normalizePhone(raw);
    if (n) out.add(n);
  }
  return [...out];
}

const WEBSITE_RE = /\b((?:https?:\/\/)?(?:www\.)[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?)/i;

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

const STREET_RE =
  /\b(via|viale|v\.le|v\.|piazza|p\.zza|p\.za|piazzale|corso|c\.so|largo|strada|str\.|localit[aà]|loc\.|contrada|c\.da|vicolo|frazione|fraz\.|borgo|lungomare|zona industriale|z\.i\.)\s+[A-Za-zÀ-ú0-9'".\s-]{2,60}?(?:,?\s*(?:n\.?|nr\.?|n°)?\s*\d{1,4}\s?[a-zA-Z]?(?:\/\d+)?)?(?=$|,|\s-\s|\s{2}|\s\d{5}\b|\s*\()/i;
const CAP_CITY_RE = /\b(\d{5})\s*[-,]?\s*([A-Za-zÀ-ú'][A-Za-zÀ-ú' .-]{1,40}?)\s*(?:\(\s*([A-Za-z]{2})\s*\)|[-,]\s*([A-Z]{2})\b|\s([A-Z]{2})\b)?(?=$|[,;.\s]|\s-)/;

const CAP_CITY_PROV_RE = /\b(\d{5})\s*[-,]?\s*([A-Za-zÀ-ú'][A-Za-zÀ-ú' .-]{1,40}?)\s*(?:\(\s*([A-Za-z]{2})\s*\)|[-,]\s*([A-Z]{2})\b|\s([A-Z]{2})\b)(?=$|[,;.\s]|\s-)/;

export function findAddress(text: string): { address: string | null; zip: string | null; city: string | null; province: string | null } {
  const street = STREET_RE.exec(text);
  const cap = CAP_CITY_PROV_RE.exec(text) ?? CAP_CITY_RE.exec(text);
  return {
    address: street ? street[0].replace(/[\s,]+$/, "").trim() : null,
    zip: cap ? cap[1]! : null,
    city: cap ? cap[2]!.trim().replace(/\s+-$/, "") : null,
    province: cap ? (cap[3] ?? cap[4] ?? cap[5] ?? null)?.toUpperCase() ?? null : null,
  };
}

// ---------------------------------------------------------------------------
// Delivery days, min order, cut-off, lead time
// ---------------------------------------------------------------------------

const DAY_TOKENS: Array<[RegExp, number]> = [
  [/^lun(?:edi|\.)?$/, 1],
  [/^mar(?:tedi|\.)?$/, 2],
  [/^mer(?:coledi|\.)?$/, 3],
  [/^gio(?:vedi|\.)?$/, 4],
  [/^ven(?:erdi|\.)?$/, 5],
  [/^sab(?:ato|\.)?$/, 6],
  [/^dom(?:enica|\.)?$/, 7],
];

function dayOf(tok: string): number | null {
  const t = fold(tok).replace(/[^a-z]/g, "");
  for (const [re, n] of DAY_TOKENS) if (re.test(t)) return n;
  return null;
}

const DELIVERY_CONTEXT = /\b(consegn\w*|giorni|giro|giri|passiamo|passaggio|scarico|scarichi|arriv\w*|recapit\w*|spedizion\w*|porto|tutti\s+i\s+giorni)\b/i;

/**
 * "consegna lun-gio" → [1,2,3,4]; "lun/mer/ven" → [1,3,5];
 * "dal lunedì al venerdì" → [1..5]; "tutti i giorni tranne la domenica" → [1..6].
 */
export function findDeliveryDays(text: string, requireContext = true): { days: number[]; text: string } | null {
  const f = fold(text);
  if (requireContext && !DELIVERY_CONTEXT.test(f)) {
    // a line made only of day names is fine too
    if (!/^(?:\s*(?:lun|mar|mer|gio|ven|sab|dom)[a-z]*\.?\s*[-/,e]?\s*){2,7}$/.test(f)) return null;
  }

  if (/tutti\s+i\s+giorni/.test(f)) {
    const except = /(?:tranne|escluso|esclusa|eccetto|salvo)\s+(?:il\s+|la\s+)?([a-z]+)/.exec(f);
    const all = [1, 2, 3, 4, 5, 6, 7];
    const ex = except ? dayOf(except[1]!) : null;
    const days = ex ? all.filter((d) => d !== ex) : all;
    return { days, text: text.trim() };
  }

  const days = new Set<number>();
  let consumed = f;
  // chains of 3+ days joined by "-" are lists, not ranges: "lun-mer-ven"
  const DAY = "(?:lun|mar|mer|gio|ven|sab|dom)[a-z]*\\.?";
  const chainRe = new RegExp(`\\b${DAY}(?:\\s*-\\s*${DAY}){2,}`, "g");
  for (const c of f.match(chainRe) ?? []) {
    for (const tok of c.split("-")) {
      const d = dayOf(tok.trim());
      if (d) days.add(d);
    }
    consumed = consumed.replace(c, " ");
  }
  // ranges: "lun-gio", "dal lunedi al venerdi", "lun → ven"
  const rangeRe = /\b(?:dal\s+)?(lun\w*|mar\w*|mer\w*|gio\w*|ven\w*|sab\w*|dom\w*)\.?\s*(?:-|–|al|a|→|>)\s*(lun\w*|mar\w*|mer\w*|gio\w*|ven\w*|sab\w*|dom\w*)\b/g;
  let m: RegExpExecArray | null;
  const scan = consumed;
  while ((m = rangeRe.exec(scan))) {
    const a = dayOf(m[1]!);
    const b = dayOf(m[2]!);
    if (a && b) {
      for (let d = a; d !== b; d = (d % 7) + 1) days.add(d);
      days.add(b);
      consumed = consumed.replace(m[0], " ");
    }
  }
  for (const tok of consumed.split(/[\s,/;+&]+|\be\b/)) {
    if (!tok) continue;
    const d = dayOf(tok);
    if (d) days.add(d);
  }
  // "escluso sabato", "tranne mercoledi"
  const ex = /(?:tranne|escluso|esclusa|eccetto|salvo|no)\s+(?:il\s+|la\s+)?([a-z]+)/.exec(f);
  if (ex) {
    const d = dayOf(ex[1]!);
    if (d) days.delete(d);
  }
  if (days.size === 0) return null;
  return { days: [...days].sort((a, b) => a - b), text: text.trim() };
}

export const DAY_LABELS = ["", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

export function formatDays(days: number[]): string {
  return days.map((d) => DAY_LABELS[d] ?? "").filter(Boolean).join(", ");
}

const MIN_ORDER_RE =
  /(?:ordine\s+)?(?:min(?:imo|\.)?)\s*(?:d['’]\s*ordine|ordine|d['’]?\s*acquisto|fatturabile|consegna)?\s*(?:(?:resta|rimane|è|e'|sempre|sono|pari\s+a|fissato\s+a|ancora|invariato\s+a)\s+){0,2}(?:di|da|:|=|€|euro)?\s*(?:€|euro|eur)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)?/i;
const MIN_ORDER_CONTEXT = /\b(ordine|ord\.|acquisto|spesa|consegna|fattura)\b/i;
const FREE_DELIVERY_RE = /(?:consegna|trasporto|spedizione)\s+(?:gratuita|gratis|omaggio)\s+(?:sopra|oltre|per\s+ordini\s+(?:sopra|oltre|superiori\s+a)|da)\s*(?:i\s*)?(?:€\s*)?(\d+(?:[.,]\d{1,2})?)/i;

export function findMinOrder(text: string): number | null {
  const f = text;
  if (!/\bmin/i.test(f)) return null;
  const m = MIN_ORDER_RE.exec(f);
  if (!m) return null;
  // "minimo 100€" alone is fine; "min 5 kg" is a product minimum quantity.
  const after = f.slice(m.index + m[0].length, m.index + m[0].length + 14);
  if (/^\s*(kg|g|gr|pz|pezzi|l|lt|crt|ct|conf|cf|confezioni|casse?|cartoni?|bottigli\w*|bt|colli|unit\w*|sacchi|buste)\b/i.test(after)) return null;
  const hasEuro = /€|euro|eur/i.test(m[0]);
  if (!hasEuro && !MIN_ORDER_CONTEXT.test(f)) return null;
  const v = parseNumber(m[1]!);
  return v !== null && v > 0 && v < 100000 ? v : null;
}

export function findFreeDelivery(text: string): number | null {
  const m = FREE_DELIVERY_RE.exec(text);
  if (!m) return null;
  return parseNumber(m[1]!);
}

const CUTOFF_RE = /\b(?:entro|prima\s+delle|non\s+oltre)\s+(?:le\s+)?(?:ore\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(?:h|ore)?/i;

export function findCutoff(text: string): string | null {
  if (!/\b(ordin\w*|entro|richiest\w*)\b/i.test(text)) return null;
  if (/\b(?:entro|prima\s+di|non\s+oltre)\s+(?:le\s+ore\s+|le\s+|ore\s+)?(?:il\s+)?mezzogiorno\b/i.test(text)) return "12:00";
  const m = CUTOFF_RE.exec(text);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

export function findLeadTime(text: string): number | null {
  const f = fold(text);
  if (!/(consegn|evas|spedi|arriv|tempi|ordin)/.test(f)) return null;
  if (/in\s+giornata|stesso\s+giorno/.test(f)) return 0;
  // "ordini entro le 18 del giorno prima" → next-day delivery
  if (/ordin\w*\s.*\b(?:del|il)\s+giorno\s+(?:prima|precedente)/.test(f)) return 1;
  if (/giorno\s+(dopo|successivo|seguente)|entro\s+24\s*h|in\s+24\s*(h|ore)|\b24\s*h\b/.test(f)) return 1;
  const m = /(?:in|entro)\s+(\d{1,2})\s*(h|ore|gg|giorni|gg\.)/.exec(f);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2]!.startsWith("h") || m[2] === "ore" ? Math.max(1, Math.ceil(n / 24)) : n;
}

// ---------------------------------------------------------------------------
// Company name
// ---------------------------------------------------------------------------

const LEGAL_FORM_RE =
  /\b(s\.?\s?r\.?\s?l\.?s?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?|s\.?\s?c\.?\s?a\.?\s?r\.?\s?l\.?|soc(?:ieta|ietà)?\.?\s+coop(?:erativa)?(?:\s+agricola)?|societ[aà]\s+agricola|az(?:ienda|\.)\s+agricola|ditta\s+individuale|&\s*c\.?|f\.?lli|fratelli)(?=\W|$)/i;

export function hasLegalForm(s: string): boolean {
  return LEGAL_FORM_RE.test(s);
}

/** Pull a company name out of a line that contains a legal form. */
export function companyFromLine(line: string): string | null {
  const m = LEGAL_FORM_RE.exec(line);
  if (!m) return null;
  // take text up to the end of the legal form, after any label like "Ditta:" / "Fornitore:"
  const end = m.index + m[0].length;
  let start = 0;
  const label = /(?:ditta|fornitore|ragione\s+sociale|azienda|da|from)\s*:\s*/i.exec(line.slice(0, m.index));
  if (label) start = label.index + label[0].length;
  // stop at a previous separator (" - ", "|", ",")
  const before = line.slice(start, m.index);
  const sep = Math.max(before.lastIndexOf(" - "), before.lastIndexOf("|"), before.lastIndexOf(","));
  if (sep >= 0) start = start + sep + (before[sep] === " " ? 3 : 1);
  const name = line.slice(start, end).replace(/^[\s:,-]+|[\s,-]+$/g, "").trim();
  if (name.length < 3 || name.length > 90) return null;
  return name;
}

/** "Ortofrutta Rossi <info@...>" → "Ortofrutta Rossi" */
export function nameFromEmailHeader(value: string): string | null {
  const m = /^"?([^"<@]{2,60}?)"?\s*<[^>]+>/.exec(value.trim());
  if (m) return m[1]!.trim();
  return null;
}

export function websiteIn(text: string): string | null {
  const m = WEBSITE_RE.exec(text);
  return m ? m[1]!.replace(/[.,;]$/, "") : null;
}

/** Normalized key used to compare supplier names ("Rossi S.r.l." ≈ "rossi srl"). */
export function supplierNameKey(name: string): string {
  return fold(name)
    .replace(LEGAL_FORM_RE, " ")
    .replace(/\b(di|e|&|the|ditta|ingrosso|distribuzione)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Line-level feature: does this line carry supplier information?
// ---------------------------------------------------------------------------

export type SupplierSignals = {
  vat: boolean;
  email: boolean;
  phone: boolean;
  address: boolean;
  legalForm: boolean;
  delivery: boolean;
  minOrder: boolean;
  freeDelivery: boolean;
  cutoff: boolean;
  keywords: boolean;
  count: number;
};

const SUPPLIER_KEYWORDS =
  /\b(tel\.?|telefono|cell\.?|cellulare|fax|whatsapp|e-?mail|pec|sede|sede\s+legale|iban|banca|rea|cciaa|cap\.?\s*soc|capitale\s+sociale|www\.|orari|ufficio|magazzino|referente|agente|commerciale|pagamento|bonifico|riba|r\.i\.ba)\b/i;

export function supplierSignals(line: string): SupplierSignals {
  const vat = PIVA_LABELED.test(line) || /\bp\.?\s?iva\b/i.test(line);
  const email = EMAIL_RE.test(line);
  EMAIL_RE.lastIndex = 0;
  const phone = /\b(tel|telefono|cell|fax|whatsapp)\b/i.test(line) || (findPhones(line).length > 0 && !/\d+[.,]\d{2}\b/.test(line));
  const address = STREET_RE.test(line) && (CAP_CITY_RE.test(line) || /\d/.test(line));
  const legalForm = LEGAL_FORM_RE.test(line);
  const delivery =
    (DELIVERY_CONTEXT.test(fold(line)) && /\b(lun|mar|mer|gio|ven|sab|dom|giorn|\d{2}\s*(?:h|ore)\b|settiman)/i.test(fold(line))) ||
    (findLeadTime(line) !== null && !/\d+[.,]\d{2}\b|€/.test(line));
  const minOrder = findMinOrder(line) !== null;
  const freeDelivery = findFreeDelivery(line) !== null;
  const cutoff = findCutoff(line) !== null;
  const keywords = SUPPLIER_KEYWORDS.test(line);
  const count = [vat, email, phone, address, legalForm, delivery, minOrder || freeDelivery, cutoff, keywords].filter(Boolean).length;
  return { vat, email, phone, address, legalForm, delivery, minOrder, freeDelivery, cutoff, keywords, count };
}
