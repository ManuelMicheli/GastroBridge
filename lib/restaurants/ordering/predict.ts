// Explainable reorder prediction from the restaurant's own order history.
// Pure module (node --test friendly). No fabricated numbers: every figure is
// derived from real orders, and nothing is predicted from fewer than one order.

export type PurchaseEvent = {
  /** Order timestamp (ISO). */
  at: string;
  qty: number;
  unitPrice: number;
};

export type ReorderStats = {
  timesOrdered: number;
  lastQty: number;
  lastOrderedAt: string;
  /** Median quantity of the last 5 orders. */
  typicalQty: number;
  /** Median days between orders (null with fewer than 2 orders). */
  intervalDays: number | null;
  daysSinceLast: number;
  /** Due again: days since last order ≥ usual interval − 1. */
  due: boolean;
  /** Average quantity bought per 30 days over the observed window. */
  monthlyQty: number;
  /** Quantity-weighted average price paid. */
  avgPricePaid: number;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const DAY = 86_400_000;

/** Round to something a cook would type: integers above 3, halves below. */
export function roundQty(q: number): number {
  if (!Number.isFinite(q) || q <= 0) return 0;
  if (q >= 3) return Math.round(q);
  return Math.max(0.5, Math.round(q * 2) / 2);
}

/**
 * @param events     purchases of ONE item (any order)
 * @param nowMs      current time
 * @param windowDays history window used for the monthly volume
 */
export function reorderStats(events: PurchaseEvent[], nowMs: number, windowDays: number): ReorderStats | null {
  const valid = events.filter((e) => e.qty > 0 && Number.isFinite(Date.parse(e.at)));
  if (valid.length === 0) return null;

  // One event per calendar day (several lines of the same item in one day = one order).
  const byDay = new Map<string, PurchaseEvent>();
  for (const e of valid) {
    const k = e.at.slice(0, 10);
    const cur = byDay.get(k);
    if (cur) {
      byDay.set(k, {
        at: cur.at > e.at ? cur.at : e.at,
        qty: cur.qty + e.qty,
        unitPrice: (cur.unitPrice * cur.qty + e.unitPrice * e.qty) / (cur.qty + e.qty),
      });
    } else {
      byDay.set(k, { ...e });
    }
  }
  const sorted = [...byDay.values()].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted[sorted.length - 1]!;
  const recent = sorted.slice(-5);

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((Date.parse(sorted[i]!.at) - Date.parse(sorted[i - 1]!.at)) / DAY);
  }
  const intervalDays = gaps.length > 0 ? Math.max(1, Math.round(median(gaps))) : null;
  const daysSinceLast = Math.max(0, Math.floor((nowMs - Date.parse(last.at)) / DAY));

  const totalQty = sorted.reduce((s, e) => s + e.qty, 0);
  const totalSpend = sorted.reduce((s, e) => s + e.qty * e.unitPrice, 0);
  const firstMs = Date.parse(sorted[0]!.at);
  const observedDays = Math.max(30, Math.min(windowDays, (nowMs - firstMs) / DAY));

  return {
    timesOrdered: sorted.length,
    lastQty: last.qty,
    lastOrderedAt: last.at,
    typicalQty: roundQty(median(recent.map((e) => e.qty))),
    intervalDays,
    daysSinceLast,
    due: intervalDays !== null && daysSinceLast >= intervalDays - 1,
    monthlyQty: (totalQty / observedDays) * 30,
    avgPricePaid: totalQty > 0 ? totalSpend / totalQty : 0,
  };
}

/** Suggested quantity: par − on hand when counted, else the typical order. */
export function suggestedQty(stats: ReorderStats | null, par: number | null, onHand: number | null): number {
  if (par !== null && onHand !== null) return roundQty(Math.max(0, par - onHand));
  return stats ? stats.typicalQty : 0;
}
