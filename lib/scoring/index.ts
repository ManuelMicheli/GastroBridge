/**
 * Public barrel for the scoring engine.
 *
 * Typical usage:
 * ```ts
 * import { rankOffers, toOffer } from "@/lib/scoring";
 *
 * const offers = products.map(p => toOffer(p, suppliersById.get(p.supplier_id)));
 * const result = rankOffers(offers, prefs);
 * ```
 */

export * from "./types";
export { checkHardConstraints } from "./constraints";
export {
  bioBonus,
  km0Bonus,
  normalizeDelivery,
  normalizePrice,
  normalizeQuality,
} from "./normalize";
export { mergePreferences, scoreOffer } from "./score";
export { rankOffers } from "./rank";
export {
  toOffer,
  toOffers,
  type ProductRowLike,
  type SupplierRowLike,
} from "./adapters";
