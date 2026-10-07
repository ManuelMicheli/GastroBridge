// Map extracted products onto the app's tables (pure, shared by UI + actions).

import type { ExtractedProduct, SaleUnit } from "./types.ts";
import { SALE_UNIT_LABELS } from "./parse/units.ts";
import { formatEuro, round2 } from "./parse/numbers.ts";
import { formatDays } from "./parse/supplier-info.ts";
import type { SupplierInfo } from "./types.ts";

/** Legacy `products.unit` values used by the supplier catalog. */
export type ProductUnit = "kg" | "g" | "lt" | "ml" | "pz" | "cartone" | "bottiglia" | "latta" | "confezione";

/** Sales-unit `unit_type` values. */
export type SalesUnitType = "piece" | "kg" | "g" | "l" | "ml" | "box" | "pallet" | "bundle" | "other";

/**
 * Product unit + price for the supplier catalog. Units the catalog cannot
 * express are converted (hg → kg, cl → lt) or folded into "confezione".
 */
export function toProductUnit(priceUnit: SaleUnit, price: number): { unit: ProductUnit; price: number } {
  switch (priceUnit) {
    case "kg": return { unit: "kg", price };
    case "g": return { unit: "g", price };
    case "hg": return { unit: "kg", price: round2(price * 10) };
    case "l": return { unit: "lt", price };
    case "cl": return { unit: "lt", price: round2(price * 100) };
    case "ml": return { unit: "ml", price };
    case "pz":
    case "mazzo": return { unit: "pz", price };
    case "cartone":
    case "cassa": return { unit: "cartone", price };
    case "bottiglia": return { unit: "bottiglia", price };
    case "latta": return { unit: "latta", price };
    default: return { unit: "confezione", price };
  }
}

export function toSalesUnitType(priceUnit: SaleUnit): SalesUnitType {
  switch (priceUnit) {
    case "kg":
    case "hg": return "kg";
    case "g": return "g";
    case "l":
    case "cl": return "l";
    case "ml": return "ml";
    case "pz":
    case "mazzo": return "piece";
    case "cartone":
    case "cassa": return "box";
    case "pallet": return "pallet";
    default: return "other";
  }
}

export function saleUnitLabel(u: SaleUnit): string {
  const l = SALE_UNIT_LABELS[u];
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** Restaurant catalog row: name carries the format so sizes stay distinct. */
export function toCatalogItem(p: Pick<ExtractedProduct, "name" | "format" | "price" | "priceUnit" | "unitPrice" | "availability" | "vatRate">): {
  product_name: string;
  unit: string;
  price: number;
  notes: string | null;
} {
  const fmt = p.format && !(p.priceUnit === "kg" && /^\d/.test(p.format) && !/×/.test(p.format)) ? p.format : null;
  const product_name = (fmt && !p.name.toLowerCase().includes(fmt.toLowerCase()) ? `${p.name} ${fmt}` : p.name).slice(0, 200);
  const notes: string[] = [];
  if (p.unitPrice && p.unitPrice.base !== measureOf(p.priceUnit)) {
    notes.push(`${formatEuro(p.unitPrice.value)}/${p.unitPrice.base}`);
  }
  if (p.vatRate != null) notes.push(`IVA ${p.vatRate}%`);
  if (p.availability) notes.push(p.availability);
  return {
    product_name,
    unit: SALE_UNIT_LABELS[p.priceUnit].slice(0, 20),
    price: round2(p.price ?? 0),
    notes: notes.length ? notes.join(" · ").slice(0, 200) : null,
  };
}

function measureOf(u: SaleUnit): string | null {
  if (u === "kg" || u === "g" || u === "hg") return "kg";
  if (u === "l" || u === "cl" || u === "ml") return "l";
  if (u === "pz") return "pz";
  return null;
}

/** Compact supplier details for restaurant_catalogs.notes (max 500 chars). */
export function supplierNotes(s: Pick<SupplierInfo, "vatNumber" | "phones" | "emails" | "pec" | "address" | "zip" | "city" | "province" | "deliveryDays" | "orderCutoff" | "freeDeliveryOver" | "notes">): string {
  const parts: string[] = [];
  if (s.vatNumber) parts.push(`P.IVA ${s.vatNumber}`);
  if (s.phones[0]) parts.push(`Tel ${s.phones.slice(0, 2).join(", ")}`);
  if (s.emails[0]) parts.push(s.emails[0]);
  if (s.pec) parts.push(`PEC ${s.pec}`);
  const addr = [s.address, [s.zip, s.city].filter(Boolean).join(" "), s.province ? `(${s.province})` : null].filter(Boolean).join(" ");
  if (addr) parts.push(addr);
  if (s.deliveryDays.length) parts.push(`Consegna: ${formatDays(s.deliveryDays)}`);
  if (s.orderCutoff) parts.push(`Ordini entro ${s.orderCutoff}`);
  if (s.freeDeliveryOver) parts.push(`Consegna gratuita da ${formatEuro(s.freeDeliveryOver)}`);
  for (const n of s.notes.slice(0, 2)) parts.push(n);
  return parts.join(" · ").slice(0, 500);
}
