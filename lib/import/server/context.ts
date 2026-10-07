/* eslint-disable @typescript-eslint/no-explicit-any */
// `as any` on Supabase calls for tables the generated types do not cover yet
// (import_memory, restaurant_catalogs) — same convention as lib/catalogs.
//
// Server-only helpers for the smart import: who is importing (and may they),
// memory load/save, and the data the review screen compares against.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { contextCan, getRestaurantContext } from "@/lib/restaurants/context";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { SUPPLIER_PLATFORM_ENABLED } from "@/lib/utils/constants";
import type { ImportHints, KnownProduct, SupplierInfo } from "../types.ts";
import { mergeHints, normalizeHints } from "../memory.ts";
import type { CatalogSnapshot, ImportPersona, PlatformSupplierMatch, SupplierContextPayload } from "../api-types.ts";
import { supplierNameKey } from "../parse/supplier-info.ts";
import { similarity } from "../match/similarity.ts";
import type { ImportCategory } from "../lexicon/categories.ts";

export type ImportActor =
  | { kind: "restaurant"; userId: string; restaurantId: string | null; scopeIds: string[]; canManage: boolean }
  | { kind: "supplier"; userId: string; supplierId: string; canEditPricing: boolean };

export type ActorResult = { ok: true; actor: ImportActor } | { ok: false; status: number; error: string };

/**
 * Resolve and authorize the importing user.
 *  - restaurant: active restaurant with `partnership.manage` (owners always);
 *    a restaurant-role user without a restaurant row yet may still analyse
 *    (the commit provisions the restaurant like createCatalog does).
 *  - supplier: active member with `catalog.edit`.
 */
export async function resolveImportActor(persona: ImportPersona): Promise<ActorResult> {
  const user = await getCachedUser();
  if (!user) return { ok: false, status: 401, error: "Sessione scaduta: accedi di nuovo." };

  if (persona === "restaurant") {
    const ctx = await getRestaurantContext();
    if (ctx) {
      if (!contextCan(ctx, "partnership.manage")) {
        return { ok: false, status: 403, error: "Il tuo ruolo non consente di aggiungere o modificare fornitori." };
      }
      return { ok: true, actor: { kind: "restaurant", userId: user.id, restaurantId: ctx.restaurantId, scopeIds: ctx.scopeIds, canManage: true } };
    }
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
    const invited = (user.user_metadata as { invited_restaurant_id?: string } | null)?.invited_restaurant_id;
    if (profile?.role === "restaurant" && !invited) {
      return { ok: true, actor: { kind: "restaurant", userId: user.id, restaurantId: null, scopeIds: [], canManage: true } };
    }
    return { ok: false, status: 403, error: "Ristorante non trovato." };
  }

  const member = await getCurrentSupplierMember();
  if (!member) return { ok: false, status: 403, error: "Profilo fornitore non trovato." };
  if (!memberCan(member, "catalog.edit")) {
    return { ok: false, status: 403, error: "Il tuo ruolo non consente di modificare il catalogo." };
  }
  return {
    ok: true,
    actor: { kind: "supplier", userId: user.id, supplierId: member.supplier_id, canEditPricing: memberCan(member, "pricing.edit") },
  };
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

function ownerColumns(actor: ImportActor, restaurantId?: string | null) {
  return actor.kind === "restaurant"
    ? { restaurant_id: restaurantId ?? actor.restaurantId, supplier_id: null }
    : { restaurant_id: null, supplier_id: actor.supplierId };
}

/** Load hints for the given keys; later keys win (pass most specific last). */
export async function loadHints(actor: ImportActor, keys: string[]): Promise<ImportHints | null> {
  const owner = ownerColumns(actor);
  if (keys.length === 0 || (!owner.restaurant_id && !owner.supplier_id)) return null;
  try {
    const supabase = await createClient();
    let q = (supabase as any).from("import_memory").select("source_key, hints").in("source_key", keys);
    q = owner.restaurant_id ? q.eq("restaurant_id", owner.restaurant_id) : q.eq("supplier_id", owner.supplier_id);
    const { data, error } = await q;
    if (error || !data?.length) return null;
    const byKey = new Map<string, unknown>((data as Array<{ source_key: string; hints: unknown }>).map((r) => [r.source_key, r.hints]));
    return mergeHints(...keys.map((k) => (byKey.has(k) ? normalizeHints(byKey.get(k)) : null)));
  } catch {
    // table not migrated yet / transient error: import works without memory
    return null;
  }
}

export async function saveHints(actor: ImportActor, keys: string[], hints: ImportHints, restaurantId?: string | null): Promise<boolean> {
  const owner = ownerColumns(actor, restaurantId);
  if (keys.length === 0 || (!owner.restaurant_id && !owner.supplier_id)) return false;
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const rows = keys.map((k) => ({ ...owner, source_key: k, hints, updated_by: actor.userId, updated_at: now }));
    const { error } = await (supabase as any)
      .from("import_memory")
      .upsert(rows, { onConflict: "restaurant_id,supplier_id,source_key" });
    if (error) {
      console.warn("[import] memory not saved:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[import] memory not saved:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Restaurant data
// ---------------------------------------------------------------------------

export async function loadRestaurantCatalogs(scopeIds: string[]): Promise<CatalogSnapshot[]> {
  if (scopeIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await (supabase as any)
    .from("restaurant_catalogs")
    .select("id, supplier_name, delivery_days, min_order_amount, notes, items:restaurant_catalog_items(id, product_name, unit, price)")
    .in("restaurant_id", scopeIds)
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    supplier_name: c.supplier_name,
    delivery_days: c.delivery_days,
    min_order_amount: c.min_order_amount !== null ? Number(c.min_order_amount) : null,
    notes: c.notes,
    items: (Array.isArray(c.items) ? c.items : []).map((it: any) => ({
      id: it.id,
      name: String(it.product_name ?? ""),
      unit: String(it.unit ?? ""),
      price: Number(it.price ?? 0),
    })),
  }));
}

const MACRO: ReadonlySet<string> = new Set(["carne", "pesce", "verdura", "frutta", "latticini", "secco", "bevande", "surgelati", "panetteria"]);

/** Names with a known category, to classify unknown words by similarity. */
export async function loadKnownProducts(actor: ImportActor): Promise<KnownProduct[]> {
  try {
    const supabase = await createClient();
    let q = supabase.from("products").select("name, macro_category").limit(3000);
    if (actor.kind === "supplier") q = q.eq("supplier_id", actor.supplierId);
    else q = q.eq("is_available", true);
    const { data } = await q.returns<Array<{ name: string; macro_category: string | null }>>();
    return (data ?? [])
      .filter((p) => p.macro_category && MACRO.has(p.macro_category))
      .map((p) => ({ name: p.name, category: p.macro_category as ImportCategory }));
  } catch {
    return [];
  }
}

/** A supplier registered on GastroBridge with the same P.IVA or name. */
export async function findPlatformSupplier(info: Pick<SupplierInfo, "name" | "vatNumber">): Promise<PlatformSupplierMatch | null> {
  if (!SUPPLIER_PLATFORM_ENABLED) return null;
  try {
    if (info.vatNumber) {
      // profiles are private: look the VAT number up with the service role and
      // return only the public supplier card.
      const admin = createAdminClient();
      const { data: prof } = await admin.from("profiles").select("id").eq("vat_number", info.vatNumber).eq("role", "supplier").limit(1).maybeSingle<{ id: string }>();
      if (prof) {
        const { data: sup } = await admin.from("suppliers").select("id, company_name, city, is_active").eq("profile_id", prof.id).limit(1).maybeSingle<{ id: string; company_name: string; city: string | null; is_active: boolean }>();
        if (sup?.is_active) return { id: sup.id, company_name: sup.company_name, city: sup.city, reason: "Stessa partita IVA" };
      }
    }
    if (info.name) {
      const key = supplierNameKey(info.name);
      const token = key.split(" ").sort((a, b) => b.length - a.length)[0];
      if (token && token.length >= 4) {
        const supabase = await createClient();
        const { data } = await supabase
          .from("suppliers")
          .select("id, company_name, city")
          .ilike("company_name", `%${token.replace(/[%_]/g, "")}%`)
          .eq("is_active", true)
          .limit(10)
          .returns<Array<{ id: string; company_name: string; city: string | null }>>();
        const best = (data ?? [])
          .map((s) => ({ s, score: similarity(key, supplierNameKey(s.company_name)) }))
          .sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 0.85) return { id: best.s.id, company_name: best.s.company_name, city: best.s.city, reason: "Nome molto simile" };
      }
    }
  } catch {
    /* service role missing / RLS: no suggestion */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supplier data
// ---------------------------------------------------------------------------

export async function loadSupplierContext(actor: Extract<ImportActor, { kind: "supplier" }>): Promise<SupplierContextPayload> {
  const supabase = await createClient();
  const [products, categories, lists] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit, price, is_available, sku, brand, category_id")
      .eq("supplier_id", actor.supplierId)
      .order("name")
      .limit(10000)
      .returns<SupplierContextPayload["products"]>(),
    supabase.from("categories").select("id, name, slug").order("sort_order").returns<SupplierContextPayload["categories"]>(),
    supabase
      .from("price_lists")
      .select("id, name, is_default")
      .eq("supplier_id", actor.supplierId)
      .order("is_default", { ascending: false })
      .returns<SupplierContextPayload["priceLists"]>(),
  ]);
  return {
    persona: "supplier",
    products: (products.data ?? []).map((p) => ({ ...p, price: Number(p.price) })),
    categories: categories.data ?? [],
    priceLists: lists.data ?? [],
    canEditPricing: actor.canEditPricing,
  };
}
