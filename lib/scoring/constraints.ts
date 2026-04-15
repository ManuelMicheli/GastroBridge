import {
  type EffectivePreferences,
  type ExclusionReason,
  type Offer,
  QUALITY_TIER_RANK,
} from "./types";

/**
 * Check all hard constraints for an offer. Returns an array of exclusion
 * reasons; if empty, the offer passes all hard constraints and is eligible
 * for scoring.
 *
 * `effective` is the already-merged global + category preferences (see
 * `score.ts#mergePreferences`). Required certifications passed here should
 * already include category-specific ones.
 *
 * Rules:
 * - If the supplier is in `blockedSupplierIds` or flagged `supplierBlocked`,
 *   returns `{ kind: "supplier_blocked" }`.
 * - If `supplierMinOrder` is defined and exceeds `minOrderMaxEur`, excludes
 *   with `min_order_too_high` (ristoratore cannot afford the min-order).
 * - If `leadTimeDays > leadTimeMaxDays`, excludes with `lead_time_too_slow`.
 * - For each required certification, the offer must include it
 *   (BIO is also satisfied by `isBio === true`).
 * - If `minQualityTier` is set, offer tier rank must be ≥ that tier's rank.
 *
 * @example
 * const reasons = checkHardConstraints(offer, effective);
 * if (reasons.length === 0) { scoreIt(offer); } else { excludeIt(offer, reasons); }
 */
export function checkHardConstraints(
  offer: Offer,
  effective: EffectivePreferences,
): ExclusionReason[] {
  const reasons: ExclusionReason[] = [];

  if (
    offer.supplierBlocked === true ||
    effective.blockedSupplierIds.includes(offer.supplierId)
  ) {
    reasons.push({ kind: "supplier_blocked" });
  }

  if (
    effective.minOrderMaxEur !== undefined &&
    offer.supplierMinOrder !== undefined &&
    offer.supplierMinOrder > effective.minOrderMaxEur
  ) {
    reasons.push({
      kind: "min_order_too_high",
      threshold: effective.minOrderMaxEur,
      actual: offer.supplierMinOrder,
    });
  }

  if (
    effective.leadTimeMaxDays !== undefined &&
    offer.leadTimeDays > effective.leadTimeMaxDays
  ) {
    reasons.push({
      kind: "lead_time_too_slow",
      max: effective.leadTimeMaxDays,
      actual: offer.leadTimeDays,
    });
  }

  for (const required of effective.requiredCertifications) {
    const hasCert =
      offer.certifications.includes(required) ||
      (required === "BIO" && offer.isBio);
    if (!hasCert) {
      reasons.push({ kind: "missing_certification", required });
    }
  }

  if (effective.minQualityTier !== undefined) {
    const minRank = QUALITY_TIER_RANK[effective.minQualityTier];
    const actualRank = QUALITY_TIER_RANK[offer.qualityTier];
    if (actualRank < minRank) {
      reasons.push({
        kind: "quality_tier_too_low",
        min: effective.minQualityTier,
        actual: offer.qualityTier,
      });
    }
  }

  return reasons;
}
