/**
 * Domain types for the scoring engine.
 *
 * These types are intentionally self-contained — they do NOT import from
 * `types/database.ts`. Callers adapt DB rows to `Offer` via `adapters.ts`
 * so this library remains pure and coupling-free.
 */

export type QualityTier = "economy" | "standard" | "premium" | "luxury";

export type CategoryMacro =
  | "carne"
  | "pesce"
  | "verdura"
  | "frutta"
  | "latticini"
  | "secco"
  | "bevande"
  | "surgelati"
  | "panetteria"
  | "altro";

export type CertificationType =
  | "DOP"
  | "IGP"
  | "STG"
  | "BIO"
  | "DOC"
  | "DOCG"
  | "IGT"
  | "HALAL"
  | "KOSHER"
  | "MSC"
  | "ASC"
  | "FAIRTRADE";

/** A single offer (supplier + product) to be scored. */
export interface Offer {
  id: string;
  supplierId: string;
  productName: string;
  unit: string;
  price: number;
  qualityTier: QualityTier;
  isBio: boolean;
  leadTimeDays: number;
  certifications: CertificationType[];
  macroCategory: CategoryMacro;
  originCountry?: string;
  // supplier-level
  supplierMinOrder?: number;
  supplierRating?: number; // 0-5
  supplierDeliveryDays?: string[]; // ['mon','thu']
  supplierBlocked?: boolean;
}

export interface GlobalPreferences {
  minOrderMaxEur?: number;
  leadTimeMaxDays?: number;
  requiredCertifications: CertificationType[];
  blockedSupplierIds: string[];
  priceWeight: number; // 0-100
  qualityWeight: number;
  deliveryWeight: number;
  preferBio: boolean;
  preferKm0: boolean;
}

export interface CategoryPreferences {
  minQualityTier?: QualityTier;
  leadTimeMaxDays?: number;
  requiredCertifications?: CertificationType[];
  priceWeight?: number;
  qualityWeight?: number;
  deliveryWeight?: number;
}

export interface Preferences {
  global: GlobalPreferences;
  byCategory: Partial<Record<CategoryMacro, CategoryPreferences>>;
}

export type ExclusionReason =
  | { kind: "min_order_too_high"; threshold: number; actual: number }
  | { kind: "lead_time_too_slow"; max: number; actual: number }
  | { kind: "missing_certification"; required: CertificationType }
  | { kind: "supplier_blocked" }
  | { kind: "quality_tier_too_low"; min: QualityTier; actual: QualityTier };

export interface ScoreBreakdown {
  price: number; // 0-100
  quality: number; // 0-100
  delivery: number; // 0-100
  bioBonus: number; // 0-10
  km0Bonus: number; // 0-10
  weights: { price: number; quality: number; delivery: number }; // normalized sum=1
}

export interface ScoredOffer {
  offer: Offer;
  score: number; // 0-100
  breakdown: ScoreBreakdown;
}

export interface RankResult {
  included: ScoredOffer[]; // sorted desc by score
  excluded: { offer: Offer; reasons: ExclusionReason[] }[];
  averagePrice: number; // among included, for "savings vs avg" badges
}

/**
 * Effective preferences after merging global + category override.
 * Weights are non-optional here (inherited from global if no override).
 */
export interface EffectivePreferences {
  minOrderMaxEur?: number;
  leadTimeMaxDays?: number;
  requiredCertifications: CertificationType[];
  blockedSupplierIds: string[];
  minQualityTier?: QualityTier;
  priceWeight: number;
  qualityWeight: number;
  deliveryWeight: number;
  preferBio: boolean;
  preferKm0: boolean;
}

export const QUALITY_TIER_RANK: Record<QualityTier, number> = {
  economy: 1,
  standard: 2,
  premium: 3,
  luxury: 4,
};
