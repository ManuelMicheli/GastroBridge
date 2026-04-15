import type { Preferences } from "./types";
import type { PreferencesBundle } from "@/lib/restaurants/preferences";
import type {
  CategoryMacro,
  CertificationType,
  QualityTier,
} from "@/types/database";

/**
 * Neutral fallback preferences used when a restaurant has no saved
 * `restaurant_preferences` row yet. Matches the DEFAULT_GLOBAL weights in
 * `lib/restaurants/preferences.ts` (60 / 30 / 10) but with NO hard
 * constraints, so no offer is excluded and ranking still runs.
 */
export const defaultPrefs: Preferences = {
  global: {
    requiredCertifications: [],
    blockedSupplierIds: [],
    priceWeight: 60,
    qualityWeight: 30,
    deliveryWeight: 10,
    preferBio: false,
    preferKm0: false,
  },
  byCategory: {},
};

/**
 * Adapt the persistence-shape `PreferencesBundle` (snake_case, DB-shaped)
 * to the scoring engine's camelCase `Preferences`. Server pages load the
 * bundle via `getPreferences(restaurantId)` and hand it to client pages.
 */
export function bundleToScoringPrefs(
  bundle: PreferencesBundle | null,
): Preferences {
  if (!bundle) return defaultPrefs;
  const g = bundle.global;

  const byCategory: Preferences["byCategory"] = {};
  for (const [macro, ov] of Object.entries(bundle.byCategory)) {
    if (!ov) continue;
    byCategory[macro as CategoryMacro] = {
      minQualityTier: ov.min_quality_tier as QualityTier | undefined ?? undefined,
      leadTimeMaxDays: ov.lead_time_max_days ?? undefined,
      requiredCertifications:
        (ov.required_certifications as CertificationType[] | undefined) ??
        undefined,
      priceWeight: ov.price_weight ?? undefined,
      qualityWeight: ov.quality_weight ?? undefined,
      deliveryWeight: ov.delivery_weight ?? undefined,
    };
  }

  return {
    global: {
      minOrderMaxEur: g.min_order_max_eur ?? undefined,
      leadTimeMaxDays: g.lead_time_max_days ?? undefined,
      requiredCertifications:
        (g.required_certifications as CertificationType[]) ?? [],
      blockedSupplierIds: g.blocked_supplier_ids ?? [],
      priceWeight: g.price_weight,
      qualityWeight: g.quality_weight,
      deliveryWeight: g.delivery_weight,
      preferBio: g.prefer_bio,
      preferKm0: g.prefer_km0,
    },
    byCategory,
  };
}
