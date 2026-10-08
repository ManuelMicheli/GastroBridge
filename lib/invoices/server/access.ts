// lib/invoices/server/access.ts
// Authorization for the finance features (Fatture fornitori, Food cost).
//   read  → analytics.financial (owner, manager, viewer)
//   write → analytics.financial + settings.manage (owner, manager)
// RLS (20261010010100 / 20261010010200) enforces the same rules in the DB.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { contextCan, getRestaurantContext, type RestaurantContext } from "@/lib/restaurants/context";
import type { Db } from "./db";

export type FinanceAccess =
  | { ok: true; ctx: RestaurantContext; db: Db; canWrite: boolean }
  | { ok: false; error: string; ctx: RestaurantContext | null };

export async function getFinanceAccess(mode: "read" | "write" = "read"): Promise<FinanceAccess> {
  const ctx = await getRestaurantContext();
  if (!ctx) return { ok: false, error: "Ristorante non trovato", ctx: null };
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
