import { checkHardConstraints } from "./constraints";
import { mergePreferences, scoreOffer } from "./score";
import {
  type CategoryMacro,
  type ExclusionReason,
  type Offer,
  type Preferences,
  type RankResult,
  type ScoredOffer,
} from "./types";

/**
 * Rank a list of offers against preferences. Each offer is evaluated with
 * the effective preferences for its own macroCategory (global + category
 * override). Offers failing hard constraints are moved to `excluded` with
 * reasons; the rest are scored.
 *
 * Peers for price normalization are drawn from offers with the same
 * macroCategory that also passed hard constraints — this keeps the
 * peer-relative price score meaningful within a category.
 *
 * Sort order: score desc, ties broken by lower price.
 *
 * @example
 * const result = rankOffers(offers, prefs);
 * result.included[0]; // best offer
 * result.excluded.forEach(({offer, reasons}) => console.warn(offer.id, reasons));
 */
export function rankOffers(
  offers: readonly Offer[],
  prefs: Preferences,
): RankResult {
  const eligible: Offer[] = [];
  const excluded: { offer: Offer; reasons: ExclusionReason[] }[] = [];

  // Pass 1: hard constraints.
  for (const offer of offers) {
    const effective = mergePreferences(prefs, offer.macroCategory);
    const reasons = checkHardConstraints(offer, effective);
    if (reasons.length === 0) {
      eligible.push(offer);
    } else {
      excluded.push({ offer, reasons });
    }
  }

  // Group eligible by category for peer-relative price normalization.
  const peersByCategory = new Map<CategoryMacro, Offer[]>();
  for (const offer of eligible) {
    const bucket = peersByCategory.get(offer.macroCategory);
    if (bucket) bucket.push(offer);
    else peersByCategory.set(offer.macroCategory, [offer]);
  }

  // Pass 2: score each eligible offer using its category peers.
  const included: ScoredOffer[] = [];
  for (const offer of eligible) {
    const effective = mergePreferences(prefs, offer.macroCategory);
    const peers = peersByCategory.get(offer.macroCategory) ?? [offer];
    included.push(scoreOffer(offer, effective, peers));
  }

  // Sort: score desc, price asc as tie-breaker.
  included.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.offer.price - b.offer.price;
  });

  const averagePrice =
    included.length > 0
      ? included.reduce((sum, s) => sum + s.offer.price, 0) / included.length
      : 0;

  return { included, excluded, averagePrice };
}
