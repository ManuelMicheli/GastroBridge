// lib/invoices/server/access.ts
// Authorization for the finance features (Fatture fornitori, Food cost).
//   read  → analytics.financial (owner, manager, viewer)
//   write → analytics.financial + settings.manage (owner, manager)
// RLS (20261010010100 / 20261010010200) enforces the same rules in the DB.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  accessPermissions,
  contextCan,
  getRestaurantContext,
  type RestaurantContext,
} from "@/lib/restaurants/context";
import type { Db } from "./db";

export type FinanceAccess =
  | { ok: true; ctx: RestaurantContext; db: Db; canWrite: boolean }
  | { ok: false; error: string; ctx: RestaurantContext | null };

/**
 * Resolve the restaurant and check the finance permissions.
 *
 * `restaurantId` (optional) targets another restaurant the user can access
 * (e.g. the Finanze `?r=` selector of a multi-sede owner); the returned ctx
 * is then re-scoped to it with the user's permissions on THAT restaurant.
 */
export async function getFinanceAccess(mode: "read" | "write" = "read", restaurantId?: string | null): Promise<FinanceAccess> {
  const base = await getRestaurantContext();
  if (!base) return { ok: false, error: "Ristorante non trovato", ctx: null };
  let ctx = base;
  if (restaurantId && restaurantId !== base.restaurantId) {
    const access = base.restaurants.find((r) => r.restaurantId === restaurantId);
    if (!access) return { ok: false, error: "Ristorante non trovato", ctx: base };
    ctx = {
      ...base,
      restaurantId: access.restaurantId,
      restaurantName: access.name,
      role: access.isOwner ? "owner" : access.role,
      isOwner: access.isOwner,
      scopeIds: [access.restaurantId],
      permissions: accessPermissions(access),
    };
  }
  if (!contextCan(ctx, "analytics.financial")) {
    return { ok: false, error: "Il tuo ruolo non include i dati economici del ristorante", ctx };
  }
  const canWrite = contextCan(ctx, "settings.manage");
  if (mode === "write" && !canWrite) {
    return { ok: false, error: "Il tuo ruolo non consente di modificare questi dati", ctx };
  }
  const db = (await createClient()) as Db;
  return { ok: true, ctx, db, canWrite };
}
