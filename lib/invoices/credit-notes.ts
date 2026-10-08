// lib/invoices/credit-notes.ts
// Auto-match a received nota di credito (TD04/TD08) to the disputed invoice it
// settles: first by explicit reference (DatiFattureCollegate / causale / line
// text), then by amount against the credit requested in the dispute.

import { normalizeVat } from "./fatturapa.ts";
import type { ParsedInvoice } from "./types.ts";

export interface DisputeCandidate {
  invoiceId: string;
  supplierVat: string | null;
  number: string;
  date: string | null;
  /** Credit requested in the dispute (taxable, cents). */
  requestedCents: number;
  disputedAt: string;
}

export interface CreditNoteMatch {
  invoiceId: string;
  method: "reference" | "amount";
}

function normNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+(?=\d)/, "");
}

export function matchCreditNote(note: ParsedInvoice, candidates: DisputeCandidate[]): CreditNoteMatch | null {
  const vat = normalizeVat(note.supplier.vatNumber);
  const sameSupplier = candidates.filter((c) => c.supplierVat === vat);
  if (sameSupplier.length === 0) return null;

  // 1. Explicit reference.
  for (const ref of note.linkedInvoices) {
    if (!ref.id) continue;
    const n = normNumber(ref.id);
    const hit = sameSupplier.find((c) => normNumber(c.number) === n && (!ref.date || !c.date || ref.date.slice(0, 4) === c.date.slice(0, 4)));
    if (hit) return { invoiceId: hit.invoiceId, method: "reference" };
  }
  const freeText = [...note.causale, ...note.lines.map((l) => l.description)].join(" ").toUpperCase();
  for (const c of sameSupplier) {
    const n = c.number.toUpperCase().trim();
    if (n.length >= 2) {
      const re = new RegExp(`(?:FATT(?:URA)?|FT|N\\.?|NR\\.?|RIF\\.?)\\s*\\.?\\s*${n.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?![A-Z0-9])`);
      if (re.test(freeText)) return { invoiceId: c.invoiceId, method: "reference" };
    }
  }

  // 2. Amount close to the requested credit (± 2 %, min € 1).
  const amountCents = Math.round(Math.abs(note.totals.taxable) * 100);
  const noteDate = note.date ?? "9999-12-31";
  const eligible = sameSupplier
    .filter((c) => c.disputedAt.slice(0, 10) <= noteDate)
    .map((c) => ({ c, delta: Math.abs(c.requestedCents - amountCents) }))
    .filter(({ c, delta }) => delta <= Math.max(100, Math.round(c.requestedCents * 0.02)))
    .sort((a, b) => a.delta - b.delta);
  if (eligible.length > 0) return { invoiceId: eligible[0]!.c.invoiceId, method: "amount" };
  return null;
}
