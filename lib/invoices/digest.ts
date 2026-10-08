// lib/invoices/digest.ts
// Text of the daily Finanze digest notification (pure, tested).

import { formatEuroCents } from "./dispute.ts";
import { CREDIT_NOTE_GRACE_DAYS } from "./status.ts";

export interface DigestContent {
  parts: string[];
  /** Most useful page to open from the notification. */
  link: string;
}

export interface DigestCounts {
  newInvoices: number;
  openCents: number;
  anomalies: number;
  dueCount: number;
  dueCents: number;
  overdueCount: number;
  staleDisputes: number;
  dishesOverTarget: number;
}

/** Digest text from the counts (pure; exported for tests). */
export function buildDigest(c: DigestCounts): DigestContent {
  const parts: string[] = [];
  if (c.anomalies > 0) {
    parts.push(
      `${c.anomalies} ${c.anomalies === 1 ? "fattura con anomalie" : "fatture con anomalie"}${c.openCents > 0 ? ` (${formatEuroCents(c.openCents)} da recuperare)` : ""}`,
    );
  }
  if (c.overdueCount > 0) parts.push(`${c.overdueCount} ${c.overdueCount === 1 ? "pagamento scaduto" : "pagamenti scaduti"}`);
  if (c.dueCount > 0) {
    parts.push(`${c.dueCount} ${c.dueCount === 1 ? "scadenza" : "scadenze"} entro 7 giorni (${formatEuroCents(c.dueCents)})`);
  }
  if (c.dishesOverTarget > 0) {
    parts.push(`${c.dishesOverTarget} ${c.dishesOverTarget === 1 ? "piatto sopra" : "piatti sopra"} il food cost obiettivo`);
  }
  if (c.staleDisputes > 0) {
    parts.push(`${c.staleDisputes} ${c.staleDisputes === 1 ? "contestazione" : "contestazioni"} senza nota di credito da ${CREDIT_NOTE_GRACE_DAYS}+ giorni`);
  }
  if (c.newInvoices > 0) parts.push(`${c.newInvoices} ${c.newInvoices === 1 ? "fattura nuova" : "fatture nuove"}`);
  const link =
    c.anomalies > 0 || c.staleDisputes > 0
      ? "/finanze/fatture?stato=anomalie"
      : c.dishesOverTarget > 0
        ? "/finanze/ricette"
        : "/finanze";
  return { parts, link };
}

