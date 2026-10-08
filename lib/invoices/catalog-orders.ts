// lib/invoices/catalog-orders.ts
// Parse private-catalog orders stored as text in orders.notes by the cart
// checkout (app/(app)/carrello/_lib/checkout.ts):
//
//   --- Rossi Carni (54,00 €) ---
//     2.5× Guanciale stagionato @ 12,00 €
//
// Quantity is a JS number ("2.5"), prices use the it-IT currency format
// ("1.234,50 €"). Pure module.

export interface CatalogOrderLine {
  supplierName: string;
  index: number;
  quantity: number;
  name: string;
  unitPrice: number;
}

const HEADER_RE = /^---\s*(.+?)\s*\(([^)]*)\)\s*---\s*$/;
const LINE_RE = /^\s+(\d+(?:\.\d+)?)×\s+(.+?)\s+@\s+(.+?)\s*$/;

/** "1.234,50 €" / "12,5 €" / "12.50" → number. */
export function parseItalianAmount(raw: string): number | null {
  let s = raw.replace(/[€\s ]/g, "").replace(/EUR/i, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseCatalogOrderNotes(notes: string | null | undefined): CatalogOrderLine[] {
  if (!notes) return [];
  const out: CatalogOrderLine[] = [];
  let supplier: string | null = null;
  let index = 0;
  for (const line of notes.split(/\r?\n/)) {
    const h = HEADER_RE.exec(line);
    if (h) {
      supplier = h[1]!.trim();
      continue;
    }
    const m = LINE_RE.exec(line);
    if (!m || !supplier) continue;
    const quantity = Number(m[1]);
    const unitPrice = parseItalianAmount(m[3]!);
    if (!Number.isFinite(quantity) || quantity <= 0 || unitPrice === null) continue;
    out.push({ supplierName: supplier, index: index++, quantity, name: m[2]!.trim(), unitPrice });
  }
  return out;
}
