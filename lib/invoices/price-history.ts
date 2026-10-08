// lib/invoices/price-history.ts
// Purchase price history per product, from the goods lines of the supplier
// invoices (purchase_price_history rows). Pure and deterministic.
//
// Prices are compared on a common base (€/kg, €/l, €/pz) when the line could
// be converted, otherwise on the invoice unit price for the same unit.

export interface PriceHistoryRow {
  price_key: string;
  description: string;
  supplier_name: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number;
  price_kg: number | null;
  price_l: number | null;
  price_pz: number | null;
  document_date: string | null;
  invoice_id: string;
}

export interface PricePointOut {
  date: string | null;
  price: number;
  quantity: number | null;
  supplierName: string | null;
  invoiceId: string;
}

export interface PriceSeries {
  priceKey: string;
  name: string;
  supplierName: string | null;
  /** "kg" | "l" | "pz" | the invoice unit. */
  unitLabel: string;
  /** Oldest → newest. */
  points: PricePointOut[];
  latest: number;
  first: number;
  min: number;
  max: number;
  /** Latest vs previous purchase (%), null with a single purchase. */
  lastChangePct: number | null;
  /** Latest vs first purchase in the window (%). */
  periodChangePct: number | null;
  purchases: number;
  lastDate: string | null;
}

type Base = "kg" | "l" | "pz" | "unit";

function priceOn(r: PriceHistoryRow, base: Base): number | null {
  const v = base === "kg" ? r.price_kg : base === "l" ? r.price_l : base === "pz" ? r.price_pz : r.unit_price;
  return v === null || v === undefined ? null : Number(v);
}

function pickBase(latest: PriceHistoryRow): Base {
  if (latest.price_kg !== null) return "kg";
  if (latest.price_l !== null) return "l";
  if (latest.price_pz !== null) return "pz";
  return "unit";
}

const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

/** Group rows (any order) into one series per product. */
export function buildPriceSeries(rows: PriceHistoryRow[]): PriceSeries[] {
  const byKey = new Map<string, PriceHistoryRow[]>();
  for (const r of rows) {
    const list = byKey.get(r.price_key);
    if (list) list.push(r);
    else byKey.set(r.price_key, [r]);
  }
  const out: PriceSeries[] = [];
  for (const [key, list] of byKey) {
    list.sort((a, b) => (a.document_date ?? "").localeCompare(b.document_date ?? ""));
    const latest = list[list.length - 1]!;
    const base = pickBase(latest);
    const sameUnit = (r: PriceHistoryRow) => base !== "unit" || (r.unit ?? "") === (latest.unit ?? "");
    const points: PricePointOut[] = [];
    for (const r of list) {
      if (!sameUnit(r)) continue;
      const p = priceOn(r, base);
      if (p === null || p <= 0) continue;
      points.push({ date: r.document_date, price: p, quantity: r.quantity !== null ? Number(r.quantity) : null, supplierName: r.supplier_name, invoiceId: r.invoice_id });
    }
    if (points.length === 0) continue;
    const prices = points.map((p) => p.price);
    const last = points[points.length - 1]!;
    // Previous purchase = last point from another invoice.
    const prev = [...points].reverse().find((p) => p.invoiceId !== last.invoiceId) ?? null;
    out.push({
      priceKey: key,
      name: latest.description,
      supplierName: latest.supplier_name,
      unitLabel: base === "unit" ? (latest.unit ?? "unità").toLowerCase() : base,
      points,
      latest: last.price,
      first: points[0]!.price,
      min: Math.min(...prices),
      max: Math.max(...prices),
      lastChangePct: prev ? pct(last.price, prev.price) : null,
      periodChangePct: points.length > 1 ? pct(last.price, points[0]!.price) : null,
      purchases: new Set(points.map((p) => p.invoiceId)).size,
      lastDate: last.date,
    });
  }
  return out.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || a.name.localeCompare(b.name));
}
