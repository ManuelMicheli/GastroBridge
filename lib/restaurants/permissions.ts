import type { RestaurantPermission, RestaurantRole } from "@/types/database";

export const RESTAURANT_ROLES: RestaurantRole[] = ["owner", "manager", "chef", "viewer"];

export const RESTAURANT_ROLE_LABELS: Record<RestaurantRole, string> = {
  owner: "Titolare",
  manager: "Manager",
  chef: "Chef",
  viewer: "Sola lettura",
};

export const RESTAURANT_ROLE_DESCRIPTIONS: Record<RestaurantRole, string> = {
  owner: "Accesso completo, compresi team e abbonamento.",
  manager: "Ordini, fornitori, cataloghi, impostazioni e analytics. Non gestisce il team.",
  chef: "Prepara e invia ordini, riceve la merce, lascia recensioni.",
  viewer: "Consulta cataloghi, ordini e analytics senza modificare nulla.",
};

/** Roles an owner can hand out from the team page. */
export const INVITABLE_RESTAURANT_ROLES: RestaurantRole[] = ["owner", "manager", "chef", "viewer"];

// Mirror of the `role_permissions_restaurant` seed (restaurant phase 1A).
// Used server-side to gate actions and client-side to hide CTAs; RLS stays
// the authoritative gate once 20261008000000_restaurant_team_rls.sql is applied.
export const RESTAURANT_ROLE_MATRIX: Record<RestaurantRole, RestaurantPermission[]> = {
  owner: [
    "order.draft",
    "order.submit",
    "order.approve",
    "order.receive",
    "catalog.read",
    "partnership.manage",
    "par_levels.manage",
    "template.manage",
    "recurring.manage",
    "issue.open",
    "issue.resolve",
    "rating.submit",
    "analytics.financial",
    "staff.manage",
    "settings.manage",
    "subscription.manage",
    "multi_sede.switch",
  ],
  manager: [
    "order.draft",
    "order.submit",
    "order.receive",
    "catalog.read",
    "partnership.manage",
    "par_levels.manage",
    "template.manage",
    "recurring.manage",
    "issue.open",
    "issue.resolve",
    "rating.submit",
    "analytics.financial",
    "settings.manage",
    "multi_sede.switch",
  ],
  chef: [
    "order.draft",
    "order.submit",
    "order.receive",
    "catalog.read",
    "par_levels.manage",
    "template.manage",
    "recurring.manage",
    "issue.open",
    "rating.submit",
  ],
  viewer: ["catalog.read", "analytics.financial"],
};

export function restaurantRoleCan(
  role: RestaurantRole | null | undefined,
  permission: RestaurantPermission,
): boolean {
  if (!role) return false;
  return RESTAURANT_ROLE_MATRIX[role]?.includes(permission) ?? false;
}
