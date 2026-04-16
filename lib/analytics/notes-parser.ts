// Parser for orders.notes text produced by createCatalogOrder.
// Format:
//   "Ordine da N fornitori, M articoli\n\n--- SupplierName (€X,XX) ---\n  QTY× ProductName (unit) @ PRICE €\n..."
//
// Marketplace orders (submitOrder) produce a single-line note like
// "Ordine da carrello (3 righe)" which is not parseable; in that case the
// structured data should come from order_items JOIN products.

const SUPPLIER_HEADER_RE = /---\s*([^()]+?)\s*\(([\d.,]+)\s*€\)\s*---/g;
const LINE_ITEM_RE = /^\s+(\d+(?:[.,]\d+)?)×\s+(.+?)\s+@\s+([\d.,]+)\s*€\s*$/gm;

export type ParsedSupplier = {
  name: string;
  subtotal: number;
};

export type ParsedLineItem = {
  supplier: string;
  quantity: number;
  productName: string;
  unitPrice: number;
  lineSubtotal: number;
};

function toNumber(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function parseSupplierHeaders(notes: string | null): ParsedSupplier[] {
  if (!notes) return [];
  const out: ParsedSupplier[] = [];
  for (const match of notes.matchAll(SUPPLIER_HEADER_RE)) {
    const name = match[1]?.trim() ?? "";
    const subtotal = toNumber(match[2] ?? "0");
    if (name) out.push({ name, subtotal });
  }
  return out;
}

/**
 * Parse line items and tag each with the supplier whose header preceded it.
 * Uses section-wise splitting so we can attribute items to the right supplier.
 */
export function parseLineItems(notes: string | null): ParsedLineItem[] {
  if (!notes) return [];

  const sections = notes.split(/---\s*[^()]+?\s*\([\d.,]+\s*€\)\s*---/);
  const headers = parseSupplierHeaders(notes);
  // sections[0] = preamble before first header; sections[1..] = body of each supplier
  const items: ParsedLineItem[] = [];

  headers.forEach((header, idx) => {
    const body = sections[idx + 1] ?? "";
    for (const match of body.matchAll(LINE_ITEM_RE)) {
      const quantity = toNumber(match[1] ?? "0");
      const productName = (match[2] ?? "").trim();
      const unitPrice = toNumber(match[3] ?? "0");
      if (productName && quantity > 0) {
        items.push({
          supplier: header.name,
          quantity,
          productName,
          unitPrice,
          lineSubtotal: quantity * unitPrice,
        });
      }
    }
  });

  return items;
}

/**
 * Normalize a product name so variants of the same product aggregate together
 * across orders. Strips parenthetical unit info, collapses whitespace, lowercases.
 * "Olio EVO (latta 5l)" → "olio evo"
 */
export function normalizeProductKey(productName: string): string {
  return productName
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
