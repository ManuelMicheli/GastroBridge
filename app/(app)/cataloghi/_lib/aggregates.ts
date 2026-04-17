// app/(app)/cataloghi/_lib/aggregates.ts
//
// Pure helpers to compute per-catalog aggregates for the Stack Gallery.
// Stays dependency-free so it can run on either server or client.

export type CatalogItemLite = {
  product_name: string;
  unit: string;
  price: number;
};

export type CatalogAggregates = {
  itemCount: number;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  priceMedian: number | null;
  /** Top 3 proxy "categories" derived from first word of product_name. */
  topCategories: Array<{ label: string; count: number }>;
};

const EMPTY: CatalogAggregates = {
  itemCount: 0,
  priceMin: null,
  priceMax: null,
  priceAvg: null,
  priceMedian: null,
  topCategories: [],
};

/**
 * Computes price statistics and a best-effort category breakdown from a flat
 * list of catalog items. All prices are assumed EUR.
 */
export function computeAggregates(items: CatalogItemLite[]): CatalogAggregates {
  if (items.length === 0) return EMPTY;

  const prices: number[] = [];
  const categoryMap = new Map<string, number>();

  for (const it of items) {
    const p = Number(it.price);
    if (Number.isFinite(p) && p >= 0) prices.push(p);

    const cat = firstWord(it.product_name);
    if (cat) categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);
  }

  if (prices.length === 0) {
    return {
      ...EMPTY,
      itemCount: items.length,
      topCategories: rankCategories(categoryMap),
    };
  }

  const sorted = [...prices].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const avg = sum / sorted.length;
  const median = computeMedian(sorted);
  const priceMin = sorted[0] ?? 0;
  const priceMax = sorted[sorted.length - 1] ?? 0;

  return {
    itemCount: items.length,
    priceMin,
    priceMax,
    priceAvg: avg,
    priceMedian: median,
    topCategories: rankCategories(categoryMap),
  };
}

function computeMedian(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 0) {
    const a = sorted[mid - 1] ?? 0;
    const b = sorted[mid] ?? 0;
    return (a + b) / 2;
  }
  return sorted[mid] ?? 0;
}

function firstWord(name: string): string | null {
  if (!name) return null;
  // Normalize: lowercase, strip punctuation, take first token of length >= 3
  const cleaned = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/);
  const token = parts[0];
  if (!token || token.length < 3) return null;
  return token;
}

function rankCategories(
  m: Map<string, number>,
): Array<{ label: string; count: number }> {
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * Logarithmic position [0..1] of `value` within [min..max]. Falls back to
 * linear when min==0 or min/max cross a zero division.
 */
export function priceDotPosition(
  value: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max))
    return 0;
  if (max <= min) return 0.5;
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min);
}
