// lib/invoices/status.ts
// Invoice status derivation, labels and KPI aggregation (pure).

import type { FindingKind, FindingSeverity, FindingStatus, InvoiceStatus } from "./types.ts";

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  da_verificare: "Da verificare",
  ok: "OK",
  anomalie: "Anomalie",
  contestata: "Contestata",
  risolta: "Risolta",
};

export const STATUS_TONES: Record<InvoiceStatus, "neutral" | "success" | "danger" | "warning" | "info"> = {
  da_verificare: "neutral",
  ok: "success",
  anomalie: "danger",
  contestata: "warning",
  risolta: "info",
};

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

export const FINDING_KIND_LABELS: Record<FindingKind, string> = {
  price_above_agreed: "Prezzo più alto",
  qty_above_received: "Quantità > ricevuta",
  qty_above_ordered: "Quantità > ordinata",
  not_ordered: "Non ordinato",
  duplicate_invoice: "Duplicato",
  possible_duplicate: "Possibile duplicato",
  vat_anomaly: "IVA insolita",
  total_mismatch: "Totale incoerente",
  missing_credit_note: "Nota di credito mancante",
  no_order_found: "Nessun ordine",
  unknown_supplier: "Fornitore sconosciuto",
};

export interface StatusInput {
  isCreditNote: boolean;
  supplierKnown: boolean;
  matchedOrders: number;
  priceChecked: boolean;
  findings: Array<{ severity: FindingSeverity; recoverable: boolean; impactCents: number; status: FindingStatus; kind: FindingKind }>;
  disputed: boolean;
  resolved: boolean;
}

export function deriveStatus(i: StatusInput): InvoiceStatus {
  if (i.resolved) return "risolta";
  if (i.disputed) return "contestata";
  const open = i.findings.filter((f) => f.status === "open");
  const actionable = open.filter(
    (f) => (f.recoverable && f.impactCents > 0) || f.severity !== "low" || f.kind === "duplicate_invoice",
  );
  if (actionable.length > 0) return "anomalie";
  if (i.isCreditNote) return "ok";
  if (!i.supplierKnown) return "da_verificare";
  if (i.matchedOrders === 0 && !i.priceChecked) return "da_verificare";
  return "ok";
}

/** Days after which a dispute without nota di credito is flagged. */
export const CREDIT_NOTE_GRACE_DAYS = 15;

export interface MonthlyRow {
  month: string; // YYYY-MM
  invoices: number;
  spendCents: number;
  foundCents: number;
  disputedCents: number;
  recoveredCents: number;
}

export interface InvoiceKpiRow {
  docDate: string | null;
  documentType: string;
  taxableCents: number;
  status: InvoiceStatus;
  openRecoverableCents: number;
  disputedCents: number;
  recoveredCents: number;
  foundCents: number;
}

/** Monthly summary over invoices (credit notes reduce spend). */
export function monthlySummary(rows: InvoiceKpiRow[], months = 6, today = new Date()): MonthlyRow[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  const map = new Map(keys.map((k) => [k, { month: k, invoices: 0, spendCents: 0, foundCents: 0, disputedCents: 0, recoveredCents: 0 }]));
  for (const r of rows) {
    const k = r.docDate?.slice(0, 7);
    const m = k ? map.get(k) : undefined;
    if (!m) continue;
    const credit = r.documentType === "TD04" || r.documentType === "TD08";
    m.invoices += 1;
    m.spendCents += credit ? -r.taxableCents : r.taxableCents;
    m.foundCents += r.foundCents;
    m.disputedCents += r.disputedCents;
    m.recoveredCents += r.recoveredCents;
  }
  return keys.map((k) => map.get(k)!);
}
