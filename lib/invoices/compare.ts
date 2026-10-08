// lib/invoices/compare.ts
// Side-by-side ordine ↔ DDT/ricevuto ↔ fattura for one invoice line, with
// the differences to highlight and their € impact (pure, used by the UI).

import type { FindingKind, FindingStatus } from "./types.ts";

export interface CompareLineInput {
  line_number: number;
  kind: string;
  quantity: number | null;
  unit_price: number;
  effective_unit_price: number | null;
  total_price: number;
  agreed_unit_price: number | null;
  agreed_source: string | null;
  ordered_qty: number | null;
  received_qty: number | null;
  ddt_number: string | null;
  order_id: string | null;
}

export interface CompareFindingInput {
  line_number: number | null;
  kind: FindingKind;
  impact_cents: number;
  recoverable: boolean;
  status: FindingStatus;
}

export interface LineComparison {
  lineNumber: number;
  ordered: { qty: number | null; price: number | null; source: "order" | "catalog" | "listino" | null } | null;
  delivered: { qty: number | null; ddt: string | null } | null;
  invoiced: { qty: number | null; price: number; total: number };
  priceDiff: boolean;
  qtyDiff: boolean;
  notOrdered: boolean;
  /** Recoverable € (cents) still open or disputed on this line. */
  impactCents: number;
  /** Line fully settled (all its findings resolved / dismissed). */
  settled: boolean;
  tone: "ok" | "diff" | "info";
}

const EPS = 1e-6;

export function compareLine(line: CompareLineInput, findings: CompareFindingInput[]): LineComparison {
  const mine = findings.filter((f) => f.line_number === line.line_number);
  const live = mine.filter((f) => f.status === "open" || f.status === "disputed");
  const price = line.effective_unit_price ?? line.unit_price;
  const source = (line.agreed_source as "order" | "catalog" | "listino" | null) ?? null;
  const ordered =
    line.order_id || line.agreed_unit_price !== null
      ? { qty: line.order_id ? line.ordered_qty : null, price: line.agreed_unit_price, source }
      : null;
  const delivered = line.received_qty !== null || line.ddt_number ? { qty: line.received_qty, ddt: line.ddt_number } : null;
  const priceDiff =
    live.some((f) => f.kind === "price_above_agreed") ||
    (line.agreed_unit_price !== null && price - line.agreed_unit_price > Math.max(0.005, line.agreed_unit_price * 0.005));
  const ref = line.received_qty ?? line.ordered_qty;
  const qtyDiff =
    live.some((f) => f.kind === "qty_above_received" || f.kind === "qty_above_ordered") ||
    (ref !== null && line.quantity !== null && line.quantity - ref > Math.max(EPS, ref * 0.03));
  const notOrdered = live.some((f) => f.kind === "not_ordered");
  const impactCents = live.filter((f) => f.recoverable).reduce((s, f) => s + Number(f.impact_cents), 0);
  return {
    lineNumber: line.line_number,
    ordered,
    delivered,
    invoiced: { qty: line.quantity, price, total: line.total_price },
    priceDiff,
    qtyDiff,
    notOrdered,
    impactCents,
    settled: mine.length > 0 && live.length === 0,
    tone: priceDiff || qtyDiff || notOrdered ? "diff" : ordered || delivered ? "ok" : "info",
  };
}
