// Restaurant-facing order status is derived from the per-supplier split
// statuses, not from `orders.status`. The supplier workflow only ever mutates
// `order_splits.status`; the parent `orders` row stays on its original value
// (typically `submitted`), so reading from `orders.status` shows a stale state
// on the restaurant side.
//
// Rule: the overall order is the least-advanced non-cancelled split. If every
// split is cancelled, the order is cancelled. When there are no splits (e.g.
// catalog-only orders with no marketplace flow) the caller's fallback wins.

const RANK: Record<string, number> = {
  draft: 0,
  submitted: 1,
  pending: 1,
  pending_confirmation: 1,
  confirmed: 2,
  preparing: 3,
  packed: 4,
  shipping: 5,
  shipped: 5,
  in_transit: 5,
  delivered: 6,
  completed: 7,
};

export function deriveOrderStatus(
  splitStatuses: string[],
  fallback: string,
): string {
  if (splitStatuses.length === 0) return fallback;
  const active = splitStatuses.filter((s) => s !== "cancelled");
  if (active.length === 0) return "cancelled";

  let minRank = Number.POSITIVE_INFINITY;
  let minStatus = active[0]!;
  for (const s of active) {
    const r = RANK[s] ?? 1;
    if (r < minRank) {
      minRank = r;
      minStatus = s;
    }
  }
  return minStatus;
}
