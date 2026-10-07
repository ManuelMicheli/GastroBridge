// Server-only helper: resolve the restaurant(s) the logged-in user works for.
//
// A user reaches a restaurant either as its OWNER (`restaurants.profile_id`)
// or as an active, accepted MEMBER (`restaurant_members`, invited from
// Impostazioni → Team). Every restaurant page and action must resolve the
// restaurant through this helper instead of `.eq("profile_id", user.id)`,
// which only matches the owner and leaves team members with empty pages.
//
// Mirrors lib/supplier/current-member.ts for the supplier area.

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { RESTAURANT_ROLE_MATRIX } from "@/lib/restaurants/permissions";
import type { RestaurantPermission, RestaurantRole } from "@/types/database";

/** Cookie remembering which restaurant the user is working on. */
export const ACTIVE_RESTAURANT_COOKIE = "gb_restaurant";

export type RestaurantAccess = {
  restaurantId: string;
  name: string;
  role: RestaurantRole;
  /** True when the user is `restaurants.profile_id` (always full access). */
  isOwner: boolean;
  isPrimary: boolean;
};

export type RestaurantContext = {
  userId: string;
  /** Restaurant the user is currently working on. */
  restaurantId: string;
  restaurantName: string;
  role: RestaurantRole;
  /** The user owns the active restaurant. */
  isOwner: boolean;
  /**
   * Restaurants whose data the pages aggregate: every restaurant the user
   * owns (multi-sede) when working as owner, otherwise only the restaurant
   * they are a member of.
   */
  scopeIds: string[];
  /** Every restaurant the user can access (owned + memberships). */
  restaurants: RestaurantAccess[];
  /** Effective permissions on the active restaurant (serializable). */
  permissions: RestaurantPermission[];
};

type OwnedRow = { id: string; name: string | null; is_primary: boolean | null };
type MemberRow = { restaurant_id: string; role: RestaurantRole };

/** All restaurants the current user can access (request-cached). */
export const getRestaurantAccessList = cache(
  async (): Promise<{ userId: string; restaurants: RestaurantAccess[] } | null> => {
    const user = await getCachedUser();
    if (!user) return null;
    const supabase = await createClient();

    const [ownedRes, memberRes] = await Promise.all([
      supabase
        .from("restaurants")
        .select("id, name, is_primary")
        .eq("profile_id", user.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true })
        .returns<OwnedRow[]>(),
      supabase
        .from("restaurant_members")
        .select("restaurant_id, role")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .not("accepted_at", "is", null)
        .order("created_at", { ascending: true })
        .returns<MemberRow[]>(),
    ]);

    const owned = ownedRes.data ?? [];
    const ownedIds = new Set(owned.map((r) => r.id));
    const memberships = (memberRes.data ?? []).filter((m) => !ownedIds.has(m.restaurant_id));

    const list: RestaurantAccess[] = owned.map((r) => ({
      restaurantId: r.id,
      name: r.name?.trim() || "Ristorante",
      role: "owner",
      isOwner: true,
      isPrimary: !!r.is_primary,
    }));

    if (memberships.length > 0) {
      const ids = memberships.map((m) => m.restaurant_id);
      const names = new Map<string, string>();
      // Readable through RLS once the team migration is applied…
      const { data: visible } = await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", ids)
        .returns<{ id: string; name: string | null }[]>();
      for (const r of visible ?? []) if (r.name) names.set(r.id, r.name);
      // …before that, read just the names of the restaurants the user is a
      // verified member of (the ids come from their own membership rows).
      const missing = ids.filter((id) => !names.has(id));
      if (missing.length > 0) {
        try {
          const admin = createAdminClient();
          const { data } = await admin
            .from("restaurants")
            .select("id, name")
            .in("id", missing)
            .returns<{ id: string; name: string | null }[]>();
          for (const r of data ?? []) if (r.name) names.set(r.id, r.name);
        } catch {
          /* service key missing: keep the generic label */
        }
      }
      for (const m of memberships) {
        list.push({
          restaurantId: m.restaurant_id,
          name: names.get(m.restaurant_id)?.trim() || "Ristorante",
          role: m.role,
          isOwner: false,
          isPrimary: false,
        });
      }
    }

    return { userId: user.id, restaurants: list };
  },
);

/** Effective permissions of an access entry (owners always have them all). */
export function accessPermissions(access: Pick<RestaurantAccess, "role" | "isOwner">): RestaurantPermission[] {
  return access.isOwner ? RESTAURANT_ROLE_MATRIX.owner : RESTAURANT_ROLE_MATRIX[access.role] ?? [];
}

export function accessCan(
  access: Pick<RestaurantAccess, "role" | "isOwner"> | null | undefined,
  permission: RestaurantPermission,
): boolean {
  if (!access) return false;
  return accessPermissions(access).includes(permission);
}

/**
 * The restaurant the current user is working on (request-cached), or null
 * for anonymous users / users without any restaurant.
 */
export const getRestaurantContext = cache(async (): Promise<RestaurantContext | null> => {
  const access = await getRestaurantAccessList();
  if (!access || access.restaurants.length === 0) return null;
  const { userId, restaurants } = access;

  let selectedId: string | undefined;
  try {
    selectedId = (await cookies()).get(ACTIVE_RESTAURANT_COOKIE)?.value;
  } catch {
    selectedId = undefined;
  }

  // Cookie (when still valid) → primary owned restaurant → first membership.
  const active =
    restaurants.find((r) => r.restaurantId === selectedId) ??
    restaurants.find((r) => r.isOwner) ??
    restaurants[0]!;

  const scopeIds = active.isOwner
    ? restaurants.filter((r) => r.isOwner).map((r) => r.restaurantId)
    : [active.restaurantId];

  return {
    userId,
    restaurantId: active.restaurantId,
    restaurantName: active.name,
    role: active.isOwner ? "owner" : active.role,
    isOwner: active.isOwner,
    scopeIds,
    restaurants,
    permissions: accessPermissions(active),
  };
});

/** True when the active restaurant grants `permission` to the current user. */
export function contextCan(
  ctx: Pick<RestaurantContext, "permissions"> | null | undefined,
  permission: RestaurantPermission,
): boolean {
  return ctx ? ctx.permissions.includes(permission) : false;
}

/** Access entry of a specific restaurant for the current user, or null. */
export async function getRestaurantAccess(restaurantId: string): Promise<RestaurantAccess | null> {
  const access = await getRestaurantAccessList();
  return access?.restaurants.find((r) => r.restaurantId === restaurantId) ?? null;
}

export type ContextResult =
  | { ok: true; ctx: RestaurantContext }
  | { ok: false; error: string };

/**
 * Resolve the active restaurant and check `permission` on it. Server actions
 * use it to authorize before touching data.
 */
export async function requireRestaurantContext(
  permission?: RestaurantPermission,
): Promise<ContextResult> {
  const ctx = await getRestaurantContext();
  if (!ctx) return { ok: false, error: "Ristorante non trovato" };
  if (permission && !contextCan(ctx, permission)) {
    return { ok: false, error: "Il tuo ruolo non consente questa operazione" };
  }
  return { ok: true, ctx };
}
