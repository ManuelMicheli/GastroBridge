import type { FefoAllocation, FefoResult, LotCandidate } from "./types";

/**
 * FEFO (First-Expired, First-Out) allocator.
 *
 * Pure function: given a list of lot candidates and a requested base quantity,
 * return the allocation plan that consumes lots with the earliest expiry date
 * first, falling back to earliest `receivedAt` when expiries tie.
 *
 * Rules:
 * 1. Only lots with `available = quantityBase - quantityReservedBase > 0` are
 *    considered.
 * 2. Sort ascending by `expiryDate` (null treated as +Infinity, i.e. last),
 *    tiebreak ascending by `receivedAt` (FIFO within same expiry).
 * 3. Greedy allocation until `requestedBase` is covered, splitting lots when
 *    needed.
 * 4. If total available is less than `requestedBase`, return
 *    `{ ok: false, reason: "insufficient_stock", shortBy, allocations }`
 *    with the partial allocations consumed so far.
 * 5. `requestedBase = 0` returns `{ ok: true, allocations: [] }` without
 *    touching any lot.
 */
export function allocateFefo(
  lots: LotCandidate[],
  requestedBase: number,
): FefoResult {
  if (!Number.isFinite(requestedBase) || requestedBase < 0) {
    throw new Error("requestedBase must be a finite non-negative number");
  }

  if (requestedBase === 0) {
    return { ok: true, allocations: [] };
  }

  const candidates = lots
    .map((lot) => ({
      lot,
      available: lot.quantityBase - lot.quantityReservedBase,
    }))
    .filter((entry) => entry.available > 0)
    .sort((a, b) => {
      const expA = a.lot.expiryDate;
      const expB = b.lot.expiryDate;
      if (expA === expB) {
        // same expiry (including both null) → FIFO by receivedAt asc
        return a.lot.receivedAt < b.lot.receivedAt
          ? -1
          : a.lot.receivedAt > b.lot.receivedAt
            ? 1
            : 0;
      }
      if (expA === null) return 1; // null = last
      if (expB === null) return -1;
      return expA < expB ? -1 : 1;
    });

  const allocations: FefoAllocation[] = [];
  let remaining = requestedBase;

  for (const entry of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(entry.available, remaining);
    allocations.push({ lotId: entry.lot.id, quantityBase: take });
    remaining -= take;
  }

  if (remaining > 0) {
    return {
      ok: false,
      reason: "insufficient_stock",
      shortBy: remaining,
      allocations,
    };
  }

  return { ok: true, allocations };
}
