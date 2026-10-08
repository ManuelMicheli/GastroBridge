"use server";

// Server actions of Finanze → Food cost. Authorization through
// getFinanceAccess (analytics.financial + settings.manage for writes); writes
// use the user client so RLS stays authoritative.

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFinanceAccess } from "@/lib/invoices/server/access";
import { chunks, rows, type Db } from "@/lib/invoices/server/db";
import { priceKeyForCatalog, priceKeyForProduct } from "@/lib/invoices/match";
import { productSimilarity } from "@/lib/invoices/text";
import { basePrices } from "@/lib/invoices/units";
import { posNameKey } from "./analysis";
import { recomputeFoodCost } from "./server/engine";

type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/finanze/ricette");
  revalidatePath("/finanze/ricette/menu");
  if (id) revalidatePath(`/finanze/ricette/${id}`);
  revalidatePath("/finanze");
}

const IngredientSchema = z.object({
  kind: z.enum(["product", "sub_recipe", "manual"]),
  priceKey: z.string().max(300).nullable(),
  productId: z.string().uuid().nullable(),
  catalogId: z.string().uuid().nullable(),
  subRecipeId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(10),
  wastePct: z.number().min(0).max(94),
  manualPrice: z.number().min(0).max(1_000_000).nullable(),
  manualPriceUnit: z.string().max(10).nullable(),
});

const RecipeSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(160),
  kind: z.enum(["dish", "base"]),
  category: z.string().trim().max(60).nullable(),
  portions: z.number().positive().max(10_000),
  yieldQty: z.number().positive().max(1_000_000).nullable(),
  yieldUnit: z.string().max(10).nullable(),
  salePrice: z.number().min(0).max(100_000).nullable(),
  vatRate: z.number().min(0).max(30),
  targetPct: z.number().gt(0).lt(100),
  notes: z.string().max(2000).nullable(),
  ingredients: z.array(IngredientSchema).max(80),
});

export async function saveRecipe(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = RecipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Ricetta non valida" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { db, ctx } = access;
  const r = parsed.data;
  if (r.ingredients.some((i) => i.kind === "sub_recipe" && (!i.subRecipeId || i.subRecipeId === r.id))) {
    return { ok: false, error: "Un semilavorato non può contenere sé stesso" };
  }
  const row = {
    restaurant_id: ctx.restaurantId,
    name: r.name,
    kind: r.kind,
    category: r.category || null,
    portions: r.portions,
    yield_qty: r.kind === "base" ? r.yieldQty : null,
    yield_unit: r.kind === "base" ? r.yieldUnit : null,
    sale_price: r.kind === "dish" ? r.salePrice : null,
    vat_rate: r.vatRate,
    target_food_cost_pct: r.targetPct,
    notes: r.notes || null,
  };
  let id = r.id;
  if (id) {
    const { error } = await db.from("recipes").update(row).eq("id", id).eq("restaurant_id", ctx.restaurantId);
    if (error) return { ok: false, error: error.message };
    const { error: delErr } = await db.from("recipe_ingredients").delete().eq("recipe_id", id);
    if (delErr) return { ok: false, error: delErr.message };
  } else {
    const { data, error } = await db.from("recipes").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Ricetta non salvata" };
    id = data.id as string;
  }
  if (r.ingredients.length > 0) {
    const { error } = await db.from("recipe_ingredients").insert(
      r.ingredients.map((i, idx) => ({
        recipe_id: id,
        restaurant_id: ctx.restaurantId,
        position: idx,
        kind: i.kind,
        price_key: i.kind === "product" ? i.priceKey : null,
        product_id: i.kind === "product" ? i.productId : null,
        catalog_id: i.kind === "product" ? i.catalogId : null,
        sub_recipe_id: i.kind === "sub_recipe" ? i.subRecipeId : null,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        waste_pct: i.wastePct,
        manual_price: i.manualPrice,
        manual_price_unit: i.manualPrice !== null ? i.manualPriceUnit : null,
      })),
    );
    if (error) return { ok: false, error: error.message };
  }
  await recomputeFoodCost(db, ctx.restaurantId).catch(() => []);
  revalidate(id!);
  return { ok: true, data: { id: id! } };
}

export async function deleteRecipe(id: string): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { error } = await access.db.from("recipes").delete().eq("id", id).eq("restaurant_id", access.ctx.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function dismissFoodCostAlert(id: string): Promise<Result> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { error } = await access.db
    .from("food_cost_alerts")
    .update({ dismissed_at: new Date().toISOString(), dismissed_by: access.ctx.userId })
    .eq("id", id)
    .eq("restaurant_id", access.ctx.restaurantId);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: undefined };
}

export async function recomputeFoodCostNow(): Promise<Result<{ alerts: number }>> {
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const alerts = await recomputeFoodCost(access.db, access.ctx.restaurantId);
  revalidate();
  return { ok: true, data: { alerts: alerts.length } };
}

const LinkSchema = z.object({
  posName: z.string().trim().min(1).max(200),
  recipeId: z.string().uuid().nullable(),
  portionsPerSale: z.number().positive().max(100).default(1),
});

export async function linkPosItem(input: unknown): Promise<Result> {
  const parsed = LinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Collegamento non valido" };
  const access = await getFinanceAccess("write");
  if (!access.ok) return { ok: false, error: access.error };
  const { db, ctx } = access;
  const key = posNameKey(parsed.data.posName);
  if (!parsed.data.recipeId) {
    await db.from("recipe_pos_links").delete().eq("restaurant_id", ctx.restaurantId).eq("pos_name_key", key);
  } else {
    const { error } = await db.from("recipe_pos_links").upsert(
      {
        restaurant_id: ctx.restaurantId,
        pos_name_key: key,
        pos_name: parsed.data.posName,
        recipe_id: parsed.data.recipeId,
        portions_per_sale: parsed.data.portionsPerSale,
      },
      { onConflict: "restaurant_id,pos_name_key" },
    );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/finanze/ricette/menu");
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* Ingredient search across purchases, catalogs and supplier listini     */
/* ------------------------------------------------------------------ */

export interface IngredientHit {
  kind: "product" | "sub_recipe";
  priceKey: string | null;
  productId: string | null;
  catalogId: string | null;
  subRecipeId: string | null;
  name: string;
  /** Suggested unit for the dose ("g" for kg prices, "ml" for litres, "pz"). */
  unit: string;
  priceLabel: string | null;
  source: "fattura" | "catalogo" | "listino" | "semilavorato";
  detail: string | null;
}

const eur = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);

function doseUnitFor(prices: Partial<Record<"kg" | "l" | "pz", number>>): { unit: string; label: string | null } {
  if (prices.kg !== undefined) return { unit: "g", label: `${eur(prices.kg)}/kg` };
  if (prices.l !== undefined) return { unit: "ml", label: `${eur(prices.l)}/l` };
  if (prices.pz !== undefined) return { unit: "pz", label: `${eur(prices.pz)}/pz` };
  return { unit: "g", label: null };
}

export async function searchIngredients(query: string): Promise<Result<IngredientHit[]>> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };
  const access = await getFinanceAccess("read");
  if (!access.ok) return { ok: false, error: access.error };
  const { ctx, db } = access;
  const admin = createAdminClient() as Db;
  const like = `%${q.replace(/[%_]/g, " ")}%`;
  const hits: Array<IngredientHit & { score: number }> = [];
  const seen = new Set<string>();
  const add = (h: IngredientHit) => {
    const key = h.priceKey ?? `sub:${h.subRecipeId}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push({ ...h, score: productSimilarity(q, h.name) + (h.source === "fattura" ? 0.05 : 0) });
  };

  // 1. What the restaurant actually bought (latest invoice price).
  const history = await rows<{ price_key: string; description: string; supplier_name: string | null; price_kg: number | null; price_l: number | null; price_pz: number | null; document_date: string | null; product_id: string | null; catalog_id: string | null }>(
    db
      .from("purchase_price_history")
      .select("price_key, description, supplier_name, price_kg, price_l, price_pz, document_date, product_id, catalog_id")
      .eq("restaurant_id", ctx.restaurantId)
      .ilike("description", like)
      .order("document_date", { ascending: false })
      .limit(60),
    "search history",
  );
  for (const h of history) {
    const d = doseUnitFor({
      kg: h.price_kg !== null ? Number(h.price_kg) : undefined,
      l: h.price_l !== null ? Number(h.price_l) : undefined,
      pz: h.price_pz !== null ? Number(h.price_pz) : undefined,
    });
    add({
      kind: "product",
      priceKey: h.price_key,
      productId: h.product_id,
      catalogId: h.catalog_id,
      subRecipeId: null,
      name: h.description,
      unit: d.unit,
      priceLabel: d.label,
      source: "fattura",
      detail: [h.supplier_name, h.document_date ? `fattura del ${h.document_date.split("-").reverse().join("/")}` : null].filter(Boolean).join(" · ") || null,
    });
  }

  // 2. Private catalogs.
  const catalogs = await rows<{ id: string; supplier_name: string }>(
    db.from("restaurant_catalogs").select("id, supplier_name").in("restaurant_id", ctx.scopeIds),
    "search catalogs",
  );
  for (const part of chunks(catalogs.map((c) => c.id), 50)) {
    const items = await rows<{ catalog_id: string; product_name: string; unit: string; price: number }>(
      db.from("restaurant_catalog_items").select("catalog_id, product_name, unit, price").in("catalog_id", part).ilike("product_name", like).limit(60),
      "search catalog items",
    );
    for (const it of items) {
      const d = doseUnitFor(basePrices(Number(it.price), it.unit, it.product_name));
      add({
        kind: "product",
        priceKey: priceKeyForCatalog(it.catalog_id, it.product_name),
        productId: null,
        catalogId: it.catalog_id,
        subRecipeId: null,
        name: it.product_name,
        unit: d.unit,
        priceLabel: d.label ?? `${eur(Number(it.price))}/${it.unit}`,
        source: "catalogo",
        detail: catalogs.find((c) => c.id === it.catalog_id)?.supplier_name ?? null,
      });
    }
  }

  // 3. Connected platform suppliers' listino.
  const rels = await rows<{ supplier_id: string }>(
    db.from("restaurant_suppliers").select("supplier_id").eq("restaurant_id", ctx.restaurantId).in("status", ["active", "paused"]),
    "search rels",
  );
  if (rels.length > 0) {
    const products = await rows<{ id: string; name: string; unit: string; price: number; packaging_size: number | null; packaging_unit: string | null; supplier: { company_name: string } | null }>(
      admin
        .from("products")
        .select("id, name, unit, price, packaging_size, packaging_unit, supplier:suppliers!supplier_id (company_name)")
        .in("supplier_id", rels.map((r) => r.supplier_id).slice(0, 100))
        .ilike("name", like)
        .limit(60),
      "search products",
    );
    for (const p of products) {
      const d = doseUnitFor(basePrices(Number(p.price), p.unit, p.name, { packagingSize: p.packaging_size, packagingUnit: p.packaging_unit }));
      add({
        kind: "product",
        priceKey: priceKeyForProduct(p.id),
        productId: p.id,
        catalogId: null,
        subRecipeId: null,
        name: p.name,
        unit: d.unit,
        priceLabel: d.label ?? `${eur(Number(p.price))}/${p.unit}`,
        source: "listino",
        detail: p.supplier?.company_name ?? null,
      });
    }
  }

  // 4. Sub-recipes.
  const subs = await rows<{ id: string; name: string; yield_unit: string | null }>(
    db.from("recipes").select("id, name, yield_unit").eq("restaurant_id", ctx.restaurantId).eq("kind", "base").ilike("name", like).limit(20),
    "search subs",
  );
  for (const s of subs) {
    add({
      kind: "sub_recipe",
      priceKey: null,
      productId: null,
      catalogId: null,
      subRecipeId: s.id,
      name: s.name,
      unit: s.yield_unit === "l" || s.yield_unit === "ml" ? "ml" : s.yield_unit === "pz" ? "pz" : "g",
      priceLabel: null,
      source: "semilavorato",
      detail: "Semilavorato",
    });
  }

  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    ok: true,
    data: hits.slice(0, 25).map(({ score: _score, ...h }) => {
      void _score;
      return { ...h, name: h.name.slice(0, 200) };
    }),
  };
}
