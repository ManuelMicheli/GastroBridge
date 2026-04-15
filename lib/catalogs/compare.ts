import type { CatalogRow, CatalogItemRow } from "./types";

export type SupplierCol = Pick<CatalogRow, "id" | "supplier_name" | "delivery_days" | "min_order_amount">;

export type PivotRow = {
  key: string;                                // `${product_name_normalized}::${unit}`
  productName: string;                        // display label (first encountered)
  unit: string;
  prices: Record<string, number | null>;      // supplierId -> price | null
  bestPriceSupplierId: string | null;
  bestCompositeSupplierId: string | null;
};

export type Pivot = {
  suppliers: SupplierCol[];
  rows: PivotRow[];
  /** Sum of all prices per supplier for products they offer. */
  totals: Record<string, number>;
  /** Sum of min price per row. */
  basketOptimalPrice: number;
  /** Sum of prices picked by composite winner per row. */
  basketOptimalComposite: number;
};

export function buildPivot(
  suppliers: SupplierCol[],
  items: (CatalogItemRow & { catalog_id: string })[],
  weights: { w_prezzo: number; w_consegna: number } = { w_prezzo: 1, w_consegna: 0 },
): Pivot {
  // Group items by (norm_name, unit)
  type Group = { productName: string; unit: string; bySupplier: Record<string, number> };
  const groups = new Map<string, Group>();
  for (const it of items) {
    const key = `${it.product_name_normalized}::${it.unit}`;
    let g = groups.get(key);
    if (!g) { g = { productName: it.product_name, unit: it.unit, bySupplier: {} }; groups.set(key, g); }
    // If same supplier has duplicate rows for the same (name, unit), keep the lowest price.
    const supplierId = supplierFor(suppliers, it.catalog_id);
    if (!supplierId) continue;
    const prev = g.bySupplier[supplierId];
    if (prev === undefined || it.price < prev) g.bySupplier[supplierId] = it.price;
  }

  const rows: PivotRow[] = [];
  for (const [key, g] of groups) {
    const prices: Record<string, number | null> = {};
    for (const s of suppliers) prices[s.id] = g.bySupplier[s.id] ?? null;

    // Best price
    const priceEntries = Object.entries(prices).filter(([, p]) => p !== null) as [string, number][];
    const bestPriceSupplierId =
      priceEntries.length === 0 ? null : priceEntries.reduce((a, b) => (a[1] <= b[1] ? a : b))[0];

    // Best composite (requires delivery_days present on the supplier's catalog)
    const compositeCandidates = priceEntries.filter(([sid]) =>
      suppliers.find((s) => s.id === sid)?.delivery_days !== null,
    );
    let bestCompositeSupplierId: string | null = null;
    if (compositeCandidates.length > 0) {
      const pArr = compositeCandidates.map(([, p]) => p);
      const minP = Math.min(...pArr), maxP = Math.max(...pArr);
      const daysArr = compositeCandidates.map(([sid]) => suppliers.find((s) => s.id === sid)!.delivery_days!);
      const minD = Math.min(...daysArr), maxD = Math.max(...daysArr);

      const scored = compositeCandidates.map(([sid, price]) => {
        const d = suppliers.find((s) => s.id === sid)!.delivery_days!;
        const normP = maxP === minP ? 0 : (price - minP) / (maxP - minP);
        const normD = maxD === minD ? 0 : (d - minD) / (maxD - minD);
        const score = weights.w_prezzo * normP + weights.w_consegna * normD;
        return { sid, score };
      });
      bestCompositeSupplierId = scored.reduce((a, b) => (a.score <= b.score ? a : b)).sid;
    }

    rows.push({ key, productName: g.productName, unit: g.unit, prices, bestPriceSupplierId, bestCompositeSupplierId });
  }

  // Totals per supplier
  const totals: Record<string, number> = {};
  for (const s of suppliers) totals[s.id] = 0;
  for (const r of rows) {
    for (const [sid, p] of Object.entries(r.prices)) if (p !== null) totals[sid]! += p;
  }

  // Optimal baskets
  let basketOptimalPrice = 0, basketOptimalComposite = 0;
  for (const r of rows) {
    if (r.bestPriceSupplierId) basketOptimalPrice += r.prices[r.bestPriceSupplierId]!;
    if (r.bestCompositeSupplierId) basketOptimalComposite += r.prices[r.bestCompositeSupplierId]!;
  }

  rows.sort((a, b) => a.productName.localeCompare(b.productName, "it"));
  return { suppliers, rows, totals, basketOptimalPrice, basketOptimalComposite };
}

function supplierFor(suppliers: SupplierCol[], catalogId: string): string | null {
  // In this model, catalog_id IS the supplier column id.
  return suppliers.find((s) => s.id === catalogId)?.id ?? null;
}
