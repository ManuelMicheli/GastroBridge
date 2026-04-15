import {
  type EffectivePreferences,
  type Offer,
  QUALITY_TIER_RANK,
} from "./types";

/**
 * Peer-relative price normalization. Returns 0-100 where lower price scores
 * higher. When all peers share the same price, returns a neutral 50.
 *
 * Peers should be filtered by the caller to offers in the same macroCategory,
 * so that e.g. "economy bread" does not make "premium olive oil" look
 * expensive.
 *
 * Formula: `100 * (maxPrice - price) / (maxPrice - minPrice)`
 *
 * @example
 * normalizePrice({price: 5, ...}, [offer@5, offer@10, offer@15]) // => 100
 * normalizePrice({price: 15, ...}, [offer@5, offer@10, offer@15]) // => 0
 * normalizePrice({price: 10, ...}, [offer@10, offer@10])           // => 50
 */
export function normalizePrice(offer: Offer, peers: readonly Offer[]): number {
  if (peers.length === 0) return 50;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const p of peers) {
    if (p.price < minPrice) minPrice = p.price;
    if (p.price > maxPrice) maxPrice = p.price;
  }
  if (maxPrice === minPrice) return 50;
  const raw = (100 * (maxPrice - offer.price)) / (maxPrice - minPrice);
  // Clamp just in case offer is outside peer range (shouldn't normally happen).
  return Math.max(0, Math.min(100, raw));
}

/**
 * Absolute quality score (0-100) derived from the quality tier.
 * Not peer-relative — a "premium" offer always scores 75 regardless of its
 * neighbors, so mediocre categories don't artificially inflate.
 *
 * economy=25, standard=50, premium=75, luxury=100.
 */
export function normalizeQuality(offer: Offer): number {
  const rank = QUALITY_TIER_RANK[offer.qualityTier];
  // 1→25, 2→50, 3→75, 4→100
  return rank * 25;
}

/**
 * Lead-time score (0-100). Faster = higher. Piecewise:
 * 0d=100, 1d=90, 2d=75, 3d=60, 4d=45, 5d=30, 6d=20, 7+d=10.
 */
export function normalizeDelivery(offer: Offer): number {
  const d = offer.leadTimeDays;
  if (d <= 0) return 100;
  if (d === 1) return 90;
  if (d === 2) return 75;
  if (d === 3) return 60;
  if (d === 4) return 45;
  if (d === 5) return 30;
  if (d === 6) return 20;
  return 10;
}

/**
 * +10 bonus if user prefers bio AND offer is bio, else 0.
 */
export function bioBonus(offer: Offer, prefs: EffectivePreferences): number {
  return prefs.preferBio && offer.isBio ? 10 : 0;
}

/**
 * +10 bonus if user prefers km0 AND offer origin is "IT", else 0.
 */
export function km0Bonus(offer: Offer, prefs: EffectivePreferences): number {
  return prefs.preferKm0 && offer.originCountry === "IT" ? 10 : 0;
}
