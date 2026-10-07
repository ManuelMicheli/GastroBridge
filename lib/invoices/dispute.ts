// lib/invoices/dispute.ts
// Polite Italian dispute message ("contestazione") asking the supplier for a
// nota di credito. Deterministic template — no AI.

import type { FindingKind } from "./types.ts";

export interface DisputeFindingInput {
  kind: FindingKind;
  title: string;
  message: string;
  impactCents: number;
  lineNumber: number | null;
}

export interface DisputeMessageInput {
  restaurantName: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  findings: DisputeFindingInput[];
  signature?: string | null;
}

const KIND_LABEL: Partial<Record<FindingKind, string>> = {
  price_above_agreed: "prezzo diverso da quello concordato",
  qty_above_received: "quantità fatturata superiore a quella consegnata",
  qty_above_ordered: "quantità fatturata superiore a quella ordinata",
  not_ordered: "articolo non ordinato",
  duplicate_invoice: "fattura già ricevuta (duplicato)",
  total_mismatch: "totale del documento non corretto",
};

export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDateIt(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function requestedCreditCents(findings: DisputeFindingInput[]): number {
  return findings.reduce((s, f) => s + Math.max(0, f.impactCents), 0);
}

/** Subject line, e.g. for the email. */
export function disputeSubject(input: DisputeMessageInput): string {
  return `Richiesta nota di credito – fattura n. ${input.invoiceNumber}${input.invoiceDate ? ` del ${formatDateIt(input.invoiceDate)}` : ""}`;
}

/** Message body (≤ 2000 chars, the chat limit, when possible). */
export function buildDisputeMessage(input: DisputeMessageInput): string {
  const total = requestedCreditCents(input.findings);
  const header = `Buongiorno ${input.supplierName},\n\nabbiamo controllato la fattura n. ${input.invoiceNumber}${
    input.invoiceDate ? ` del ${formatDateIt(input.invoiceDate)}` : ""
  } e abbiamo riscontrato alcune differenze rispetto a quanto ordinato e ricevuto:`;
  const items = input.findings.map((f, i) => {
    const label = KIND_LABEL[f.kind] ?? "differenza";
    const where = f.lineNumber ? ` (riga ${f.lineNumber})` : "";
    return `${i + 1}. ${f.title.replace(/^[^:]+:\s*/, "")}${where} – ${label}: ${f.message} Importo: ${formatEuroCents(f.impactCents)}.`;
  });
  const footer = `\nVi chiediamo cortesemente di emettere una nota di credito di ${formatEuroCents(total)} (imponibile) a rettifica della fattura${
    input.invoiceDate ? "" : ""
  }. Restiamo a disposizione per qualsiasi chiarimento.\n\nGrazie e buona giornata,\n${input.signature?.trim() || input.restaurantName}`;
  let body = [header, "", ...items, footer].join("\n");
  if (body.length > 1990) {
    // Keep it within the chat limit: summarise the items.
    const short = input.findings.map((f, i) => `${i + 1}. ${f.title.replace(/^[^:]+:\s*/, "")}: ${formatEuroCents(f.impactCents)}`);
    body = [header, "", ...short, footer].join("\n");
    if (body.length > 1990) body = `${body.slice(0, 1985)}…`;
  }
  return body;
}

/** mailto: link with subject + body (for suppliers not on GastroBridge). */
export function disputeMailto(email: string | null, input: DisputeMessageInput): string {
  const params = new URLSearchParams({ subject: disputeSubject(input), body: buildDisputeMessage(input) });
  return `mailto:${email ?? ""}?${params.toString().replace(/\+/g, "%20")}`;
}
