// Shared (client + server) types for the restaurant ordering superpowers.

import type { CartItem } from "@/types/orders";
import type { UnitType } from "@/types/database";

/** Something the restaurant can order right now (marketplace product or private catalog line). */
export type Offer = {
  /** Stable item key: "p:<product id>" or "c:<catalog id>:<normalized name>|<unit>". */
  key: string;
  kind: "product" | "catalog";
  /** products.id or restaurant_catalog_items.id */
  offerId: string;
  /** Cart line id: products.id or "catalog_<item id>" (see carrello/_lib/checkout.ts). */
  cartProductId: string;
  /** Cart supplier id: suppliers.id or restaurant_catalogs.id */
  supplierKey: string;
  supplierName: string;
  name: string;
  /** Name used for pack-size parsing (adds products.packaging_size/unit). */
  packName: string;
  unit: string;
  price: number;
  brand: string | null;
  imageUrl: string | null;
  minQuantity: number;
};

export type SupplierRef = {
  key: string;
  kind: "product" | "catalog";
  name: string;
  minOrderAmount: number | null;
  /** restaurant_catalogs.delivery_days (lead time) for private catalogs. */
  catalogLeadDays: number | null;
  /** Restaurant owning the private catalog (null for platform suppliers). */
  restaurantId: string | null;
};

export type ScheduleInfo = {
  weekdays: number[];
  cutoffTime: string | null;
  leadDays: number;
  reminderEnabled: boolean;
  /** "restaurant" = set on /consegne; "supplier" = supplier delivery zone. */
  source: "restaurant" | "supplier";
  scheduleId: string | null;
  notes: string | null;
};

/** Cart line for an offer (same shape the search page produces). */
export function offerToCartItem(offer: Offer, quantity: number): CartItem {
  return {
    productId: offer.cartProductId,
    supplierId: offer.supplierKey,
    supplierName: offer.supplierName,
    name: offer.kind === "catalog" ? `${offer.name} (${offer.unit})` : offer.name,
    brand: offer.brand,
    unit: (offer.unit || "pz") as UnitType,
    unitPrice: offer.price,
    quantity,
    imageUrl: offer.imageUrl,
    minQuantity: offer.minQuantity,
  };
}

/** Quantities like "1,5" / "12" without trailing zeros. */
export function formatQty(q: number): string {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(q);
}
