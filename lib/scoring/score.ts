import {
  bioBonus,
  km0Bonus,
  normalizeDelivery,
  normalizePrice,
  normalizeQuality,
} from "./normalize";
import {
  type CategoryMacro,
  type EffectivePreferences,
  type Offer,
  type Preferences,
  type ScoredOffer,
} from "./types";

/**
 * Merge global + category-level preferences into a single effective set.
 * Category values override global where defined. Required certifications
 * are unioned (both apply). Weights inherit from global unless the category
 * provides its own.
 *
 * @example
 * const eff = mergePreferences(prefs, "pesce");
 * // eff.minQualityTier === prefs.byCategory.pesce?.minQualityTier
 */
export function mergePreferences(
  prefs: Preferences,
  category: CategoryMacro,
): EffectivePreferences {
  const g = prefs.global;
  const c = prefs.byCategory[category];

  const requiredCerts = new Set<typeof g.requiredCertifications[number]>(
    g.requiredCertifications,
  );
  if (c?.requiredCertifications) {
    for (const cert of c.requiredCertifications) requiredCerts.add(cert);
  }

  return {
    minOrderMaxEur: g.minOrderMaxEur,
    leadTimeMaxDays: c?.leadTimeMaxDays ?? g.leadTimeMaxDays,
    requiredCertifications: Array.from(requiredCerts),
    blockedSupplierIds: g.blockedSupplierIds,
    minQualityTier: c?.minQualityTier,
    priceWeight: c?.priceWeight ?? g.priceWeight,
    qualityWeight: c?.qualityWeight ?? g.qualityWeight,
    deliveryWeight: c?.deliveryWeight ?? g.deliveryWeight,
    preferBio: g.preferBio,
    preferKm0: g.preferKm0,
  };
}

/**
 * Score a single offer against effective preferences, using `peers` for
 * price normalization (peers must share macroCategory).
 *
 * Algorithm:
 * 1. Normalize each weight so `w_p + w_q + w_d = 1`. If all three are 0,
 *    fall back to equal thirds.
 * 2. `base = w_p*normPrice + w_q*normQuality + w_d*normDelivery`.
 * 3. Add bio + km0 bonuses (each max +10), clamp to [0, 100].
 *
 * @example
 * const scored = scoreOffer(offer, effective, peerOffers);
 * console.log(scored.score, scored.breakdown);
 */
export function scoreOffer(
  offer: Offer,
  effective: EffectivePreferences,
  peers: readonly Offer[],
): ScoredOffer {
  const rawP = effective.priceWeight;
  const rawQ = effective.qualityWeight;
  const rawD = effective.deliveryWeight;
  const total = rawP + rawQ + rawD;
  const [wp, wq, wd] =
    total > 0
      ? [rawP / total, rawQ / total, rawD / total]
      : [1 / 3, 1 / 3, 1 / 3];

  const normPrice = normalizePrice(offer, peers);
  const normQuality = normalizeQuality(offer);
  const normDelivery = normalizeDelivery(offer);
  const bBonus = bioBonus(offer, effective);
  const kBonus = km0Bonus(offer, effective);

  const base = wp * normPrice + wq * normQuality + wd * normDelivery;
  const score = Math.max(0, Math.min(100, base + bBonus + kBonus));

  return {
    offer,
    score,
    breakdown: {
      price: normPrice,
      quality: normQuality,
      delivery: normDelivery,
      bioBonus: bBonus,
      km0Bonus: kBonus,
      weights: { price: wp, quality: wq, delivery: wd },
    },
  };
}
