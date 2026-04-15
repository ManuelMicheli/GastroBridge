import type { SupplierRole, SupplierPermission } from "@/types/database";

export const ROLE_LABELS: Record<SupplierRole, string> = {
  admin: "Amministratore",
  sales: "Commerciale",
  warehouse: "Magazziniere",
  driver: "Autista",
};

// Mirror del seed — utile lato client per disabilitare CTA prima del round-trip.
// RLS rimane l'unico gate autoritativo.
export const ROLE_MATRIX: Record<SupplierRole, SupplierPermission[]> = {
  admin: [
    "order.read",
    "order.accept_line",
    "order.prepare",
    "pricing.read",
    "pricing.edit",
    "catalog.read",
    "catalog.edit",
    "stock.read",
    "stock.receive",
    "stock.adjust",
    "ddt.generate",
    "ddt.manage_templates",
    "delivery.plan",
    "delivery.execute",
    "staff.manage",
    "settings.manage",
    "analytics.financial",
    "reviews.reply",
  ],
  sales: [
    "order.read",
    "order.accept_line",
    "catalog.read",
    "catalog.edit",
    "pricing.read",
    "pricing.edit",
    "delivery.plan",
    "analytics.financial",
    "reviews.reply",
  ],
  warehouse: [
    "order.read",
    "order.prepare",
    "catalog.read",
    "stock.read",
    "stock.receive",
    "stock.adjust",
    "ddt.generate",
    "delivery.execute",
  ],
  driver: ["order.read", "delivery.execute"],
};

export function hasPermission(role: SupplierRole, perm: SupplierPermission): boolean {
  return ROLE_MATRIX[role].includes(perm);
}
