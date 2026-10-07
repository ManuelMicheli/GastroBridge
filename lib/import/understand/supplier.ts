// Assemble SupplierInfo from the lines that carry supplier details.

import type { FieldConfidence, ImportHints, SupplierInfo } from "../types.ts";
import {
  companyFromLine,
  emptySupplier,
  findAddress,
  findCutoff,
  findDeliveryDays,
  findEmails,
  findFiscalCode,
  findFreeDelivery,
  findLeadTime,
  findMinOrder,
  findPhones,
  findVatNumber,
  isPec,
  websiteIn,
} from "../parse/supplier-info.ts";
import { fold, sentenceCase } from "../text.ts";

export type SupplierEvidence = {
  /** Lines classified as supplier info, preambles, signatures. */
  lines: string[];
  /** Every non-product line (fallback scan for P.IVA / e-mail). */
  otherLines: string[];
  /** "Da: Ortofrutta Rossi <…>" display names. */
  emailFromNames: string[];
  emailFromAddresses: string[];
  /** WhatsApp senders (count by frequency). */
  chatSenders: string[];
  /** Short title-like lines seen before the first product. */
  titleCandidates: string[];
  fileName?: string;
};

const fc = (score: number, reason: string): FieldConfidence => ({ score, reason });

const BUSINESS_WORDS =
  /\b(ortofrutta|ortofrutticol\w*|ingross\w*|distribuzion\w*|alimentar\w*|caseifici\w*|latteri\w*|macelleri\w*|salumific\w*|pescheri\w*|ittic\w*|forno|panifici\w*|pasticceri\w*|cantin\w*|enotec\w*|vini|birrifici\w*|azienda|import|export|food|foods|frigo\w*|surgelat\w*|bevande|beverage|horeca|ho\.re\.ca|cash\s*&?\s*carry|mercato|frutta\s+e\s+verdura|carni|pastifici\w*|molin\w*|oleifici\w*|torrefazion\w*|caff[eè]|packaging|forniture)\b/i;

function mostFrequent(list: string[]): string | null {
  const m = new Map<string, number>();
  for (const s of list) m.set(s, (m.get(s) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}

export function buildSupplier(ev: SupplierEvidence, hints: ImportHints | null): SupplierInfo {
  const s = emptySupplier();
  const text = ev.lines.join("\n");
  const all = [...ev.lines, ...ev.otherLines].join("\n");

  // P.IVA
  const vat = findVatNumber(text) ?? findVatNumber(all);
  if (vat) {
    s.vatNumber = vat.value;
    s.vatNumberValid = vat.valid;
    s.confidence.vatNumber = vat.valid
      ? fc(vat.labeled ? 0.98 : 0.85, vat.labeled ? "P.IVA con codice di controllo valido" : "Numero di 11 cifre con controllo P.IVA valido")
      : fc(0.4, "P.IVA con codice di controllo NON valido: verifica");
  }
  s.fiscalCode = findFiscalCode(text);

  // contacts
  const emails = [...new Set([...findEmails(text), ...ev.emailFromAddresses.map((e) => e.toLowerCase())])];
  const pec = emails.find((e) => isPec(e, ev.lines.find((l) => l.toLowerCase().includes(e)) ?? ""));
  s.pec = pec ?? null;
  s.emails = emails.filter((e) => e !== pec);
  if (s.emails.length) s.confidence.emails = fc(0.95, "Indirizzo e-mail trovato");
  const phoneLines = ev.lines.filter((l) => !/\bfax\b/i.test(l) || /\btel/i.test(l));
  s.phones = findPhones(phoneLines.join("\n"), s.vatNumber ? [s.vatNumber] : []).slice(0, 4);
  if (s.phones.length) s.confidence.phones = fc(0.85, "Numero di telefono italiano");
  s.website = websiteIn(text);

  // address
  for (const l of ev.lines) {
    const a = findAddress(l);
    if (a.address || a.zip) {
      s.address ??= a.address;
      s.zip ??= a.zip;
      s.city ??= a.city ? sentenceCase(a.city) : null;
      s.province ??= a.province;
      if (s.address && s.zip) break;
    }
  }
  if (s.address || s.city) s.confidence.address = fc(s.address && s.zip ? 0.85 : 0.6, s.address && s.zip ? "Indirizzo con CAP" : "Indirizzo parziale");

  // delivery, min order, cut-off, lead time
  for (const l of ev.lines) {
    if (s.deliveryDays.length === 0) {
      const d = findDeliveryDays(l);
      if (d) {
        s.deliveryDays = d.days;
        s.deliveryDaysText = d.text;
        s.confidence.deliveryDays = fc(0.85, `Da “${d.text.slice(0, 60)}”`);
      }
    }
    if (s.minOrder === null) {
      const m = findMinOrder(l);
      if (m !== null) {
        s.minOrder = m;
        s.confidence.minOrder = fc(0.9, `Da “${l.trim().slice(0, 60)}”`);
      }
    }
    s.freeDeliveryOver ??= findFreeDelivery(l);
    s.orderCutoff ??= findCutoff(l);
    if (s.leadTimeDays === null) {
      const lt = findLeadTime(l);
      if (lt !== null) {
        s.leadTimeDays = lt;
        s.confidence.leadTimeDays = fc(0.8, `Da “${l.trim().slice(0, 60)}”`);
      }
    }
    if (/\b(pagament\w*|bonifico|ri\.?ba|contrassegno|orari\w*|chiusur\w*|ferie)\b/i.test(l) && s.notes.length < 5) {
      s.notes.push(l.trim().slice(0, 160));
    }
  }

  // company name, strongest evidence first
  const legal = ev.lines.map(companyFromLine).find((x): x is string => !!x)
    ?? ev.otherLines.map(companyFromLine).find((x): x is string => !!x);
  const business = [...ev.titleCandidates, ...ev.lines].find((l) => BUSINESS_WORDS.test(l) && l.length <= 60 && !/@|\d{5}/.test(l));
  const sender = mostFrequent(ev.chatSenders);
  if (legal) {
    s.name = legal;
    s.confidence.name = fc(0.92, "Ragione sociale con forma giuridica");
  } else if (ev.emailFromNames[0]) {
    s.name = ev.emailFromNames[0];
    s.confidence.name = fc(0.75, "Mittente dell’e-mail");
  } else if (business) {
    s.name = cleanName(business);
    s.confidence.name = fc(0.7, "Nome con attività riconosciuta");
  } else if (sender && !/^\+?\d[\d\s]+$/.test(sender)) {
    s.name = sender;
    s.confidence.name = fc(0.55, "Mittente del messaggio");
  } else if (ev.titleCandidates[0]) {
    s.name = cleanName(ev.titleCandidates[0]);
    s.confidence.name = fc(0.45, "Prima riga del documento");
  } else {
    const email = s.emails[0] ?? s.pec;
    const domain = email ? /@([a-z0-9-]+)\./i.exec(email)?.[1] : null;
    if (domain && !/^(gmail|libero|hotmail|outlook|yahoo|icloud|tiscali|virgilio|alice|tin|live|fastwebnet|pec|legalmail|aruba)$/i.test(domain)) {
      s.name = sentenceCase(domain.replace(/[-_]/g, " "));
      s.confidence.name = fc(0.35, "Dedotto dal dominio e-mail");
    } else if (ev.fileName) {
      const base = ev.fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\b(listino|prezzi|catalogo|offerta|\d{2,4})\b/gi, " ").trim();
      if (base.length >= 3) {
        s.name = sentenceCase(base);
        s.confidence.name = fc(0.3, "Dedotto dal nome del file");
      }
    }
  }

  // fill gaps from memory
  const mem = hints?.supplier;
  if (mem) {
    if (!s.name && mem.name) { s.name = mem.name; s.confidence.name = fc(0.8, "Ricordato dall’import precedente"); }
    if (!s.vatNumber && mem.vatNumber) { s.vatNumber = mem.vatNumber; s.vatNumberValid = true; s.confidence.vatNumber = fc(0.8, "Ricordato dall’import precedente"); }
    if (s.emails.length === 0 && mem.emails?.length) s.emails = mem.emails;
    if (s.phones.length === 0 && mem.phones?.length) s.phones = mem.phones;
    if (!s.address && mem.address) s.address = mem.address;
    if (s.deliveryDays.length === 0 && mem.deliveryDays?.length) { s.deliveryDays = mem.deliveryDays; s.confidence.deliveryDays = fc(0.75, "Ricordato dall’import precedente"); }
    if (s.minOrder === null && mem.minOrder != null) { s.minOrder = mem.minOrder; s.confidence.minOrder = fc(0.75, "Ricordato dall’import precedente"); }
    if (s.leadTimeDays === null && mem.leadTimeDays != null) s.leadTimeDays = mem.leadTimeDays;
  }
  return s;
}

function cleanName(s: string): string {
  const t = s
    .replace(/^(?:da|from|fornitore|ditta|azienda)\s*:\s*/i, "")
    .replace(/[,;:].*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
  const f = fold(t);
  return f === t.toLowerCase() || t === t.toUpperCase() ? sentenceCase(t.toLowerCase()).replace(/\b\w/g, (c) => c.toUpperCase()) : t;
}
