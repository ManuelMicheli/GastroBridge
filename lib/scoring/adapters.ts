import type {
  CategoryMacro,
  CertificationType,
  Offer,
  QualityTier,
} from "./types";

/**
 * Minimal shape of a `products` row we need to build an Offer. This is kept
 * structurally compatible with `types/database.ts` `products.Row` but
 * intentionally narrower so the scoring lib stays decoupled.
 */
export interface ProductRowLike {
  id: string;
  supplier_id: string;
  name: string;
  unit: string;
  price: number;
  quality_tier: QualityTier;
  is_bio: boolean;
  lead_time_days: number;
  certifications_structured: CertificationType[];
  macro_category: CategoryMacro;
  origin_country: string | null;
}

/**
 * Minimal shape of a `suppliers` row we need.
 */
export interface SupplierRowLike {
  id: string;
  min_order_amount: number | null;
  rating_avg: number | null;
  delivery_days: Record<string, unknown> | null;
  is_active: boolean;
}

/**
 * Build an `Offer` from a product row plus (optional) its supplier row.
 *
 * Supplier-level fields default to `undefined` when the supplier row is
 * not provided — callers that only pass `product` will still get a valid
 * Offer, but hard constraints tied to supplier-level data (min order,
 * blocked) will simply not trigger.
 *
 * `supplierBlocked` is derived from `is_active === false`.
 *
 * @example
 * const offer = toOffer(productRow, supplierRow);
 * rankOffers([offer], prefs);
 */
export function toOffer(
  product: ProductRowLike,
  supplier?: SupplierRowLike | null,
): Offer {
  const deliveryDays = supplier?.delivery_days;
  const supplierDeliveryDays: string[] | undefined =
    deliveryDays && typeof deliveryDays === "object"
      ? Object.keys(deliveryDays).filter(
          (k) => (deliveryDays as Record<string, unknown>)[k] === true,
        )
      : undefined;

  return {
    id: product.id,
    supplierId: product.supplier_id,
    productName: product.name,
    unit: product.unit,
    price: product.price,
    qualityTier: product.quality_tier,
    isBio: product.is_bio,
    leadTimeDays: product.lead_time_days,
    certifications: product.certifications_structured ?? [],
    macroCategory: product.macro_category,
    originCountry: product.origin_country ?? undefined,
    supplierMinOrder: supplier?.min_order_amount ?? undefined,
    supplierRating: supplier?.rating_avg ?? undefined,
    supplierDeliveryDays,
    supplierBlocked: supplier ? supplier.is_active === false : undefined,
  };
}

/**
 * Batch convenience helper. Each product is paired with its supplier via
 * the provided `suppliersById` map.
 */
export function toOffers(
  products: readonly ProductRowLike[],
  suppliersById: ReadonlyMap<string, SupplierRowLike>,
): Offer[] {
  return products.map((p) => toOffer(p, suppliersById.get(p.supplier_id)));
}
