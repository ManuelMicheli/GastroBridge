import type { PlanType } from "@/types/database";

interface PlanConfig {
  plan: PlanType;
  stripePriceId: string | undefined;
  features: string[];
}

export const PLAN_FEATURES: Record<string, string[]> = {
  free: ["search", "compare", "orders_10"],
  pro: ["search", "compare", "orders_unlimited", "alerts", "analytics", "locations_3", "templates"],
  business: ["search", "compare", "orders_unlimited", "alerts", "analytics", "locations_unlimited", "team", "api", "priority_support"],
  base: ["profile", "products_100", "orders", "zones_1"],
  growth: ["profile", "products_unlimited", "orders", "csv_import", "analytics", "zones_unlimited", "verified"],
  enterprise: ["profile", "products_unlimited", "orders", "csv_import", "analytics", "zones_unlimited", "verified", "api", "account_manager", "sla", "priority_results"],
};

export function getPlanStripePriceId(plan: PlanType): string | undefined {
  const envMap: Partial<Record<PlanType, string>> = {
    pro: process.env.STRIPE_PRICE_RESTAURANT_PRO,
    business: process.env.STRIPE_PRICE_RESTAURANT_BUSINESS,
    base: process.env.STRIPE_PRICE_SUPPLIER_BASE,
    growth: process.env.STRIPE_PRICE_SUPPLIER_GROWTH,
    enterprise: process.env.STRIPE_PRICE_SUPPLIER_ENTERPRISE,
  };
  return envMap[plan];
}

export function hasFeature(plan: PlanType, feature: string): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}
