// lib/food-cost/server/engine.ts
// Server side of the food cost: price book (latest invoice price first,
// then catalog / listino), recipe loading, recomputation with snapshots and
// target-crossing alerts. Callers authorize first (getFinanceAccess) or are
// trusted jobs (invoice pipeline, webhook, cron).

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { basePrices } from "@/lib/invoices/units";
import { priceKeyForCatalog } from "@/lib/invoices/match";
import { chunks, rows, type Db } from "@/lib/invoices/server/db";
import { costRecipes, type PriceBook, type PricePoint, type RecipeCost, type RecipeInput } from "../cost";
import { detectCrossing, snapshotOf, type CostSnapshot, type FoodCostAlert } from "../analysis";

export interface RecipeRow {
  id: string;
  name: string;
  kind: "dish" | "base";
  category: string | null;
  portions: number;
  yield_qty: number | null;
  yield_unit: string | null;
  sale_price: number | null;
  vat_rate: number;
  target_food_cost_pct: number;
  notes: string | null;
  is_active: boolean;
  last_food_cost_pct: number | null;
  last_cost_per_portion: number | null;
  updated_at: string;
}

export interface IngredientRow {
  id: string;
  recipe_id: string;
  position: number;
  kind: "product" | "sub_recipe" | "manual";
  price_key: string | null;
  product_id: string | null;
  catalog_id: string | null;
  sub_recipe_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  waste_pct: number;
  manual_price: number | null;
  manual_price_unit: string | null;
}

export async function loadRecipes(db: Db, restaurantId: string): Promise<{ recipes: RecipeRow[]; ingredients: IngredientRow[] }> {
  const recipes = await rows<RecipeRow>(
    db
      .from("recipes")
      .select("id, name, kind, category, portions, yield_qty, yield_unit, sale_price, vat_rate, target_food_cost_pct, notes, is_active, last_food_cost_pct, last_cost_per_portion, updated_at")
      .eq("restaurant_id", restaurantId)
      .order("name", { ascending: true }),
    "recipes",
  );
  const ingredients = await rows<IngredientRow>(
    db
      .from("recipe_ingredients")
      .select("id, recipe_id, position, kind, price_key, product_id, catalog_id, sub_recipe_id, name, quantity, unit, waste_pct, manual_price, manual_price_unit")
      .eq("restaurant_id", restaurantId)
      .order("position", { ascending: true }),
    "recipe_ingredients",
  );
  return { recipes, ingredients };
}

export function toRecipeInputs(recipes: RecipeRow[], ingredients: IngredientRow[]): RecipeInput[] {
  const byRecipe = new Map<string, IngredientRow[]>();
  for (const i of ingredients) byRecipe.set(i.recipe_id, [...(byRecipe.get(i.recipe_id) ?? []), i]);
  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    portions: Number(r.portions) || 1,
    yieldQty: r.yield_qty !== null ? Number(r.yield_qty) : null,
    yieldUnit: r.yield_unit,
    salePrice: r.sale_price !== null ? Number(r.sale_price) : null,
    vatRate: Number(r.vat_rate),
    targetFoodCostPct: Number(r.target_food_cost_pct),
    ingredients: (byRecipe.get(r.id) ?? []).map((i) => ({
      id: i.id,
      kind: i.kind,
      priceKey: i.price_key,
      subRecipeId: i.sub_recipe_id,
      name: i.name,
      quantity: Number(i.quantity),
      unit: i.unit,
      wastePct: Number(i.waste_pct),
      manualPrice: i.manual_price !== null ? Number(i.manual_price) : null,
      manualPriceUnit: i.manual_price_unit,
    })),
  }));
}

function push(book: PriceBook, p: PricePoint) {
  const list = book.get(p.priceKey) ?? [];
  if (!list.some((x) => x.base === p.base)) list.push(p);
  book.set(p.priceKey, list);
}

/**
 * Price book for the given keys: invoice history (latest per key and base)
 * wins over catalog and listino prices. Service-role reads scoped to the
 * restaurant (products of platform suppliers may be unavailable/hidden).
 */
export async function loadPriceBook(restaurantId: string, keys: string[]): Promise<PriceBook> {
  const admin = createAdminClient() as Db;
  const book: PriceBook = new Map();
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return book;

  for (const part of chunks(unique, 100)) {
    const hist = await rows<{
      price_key: string;
      price_kg: number | null;
      price_l: number | null;
      price_pz: number | null;
      document_date: string | null;
      supplier_name: string | null;
      description: string;
    }>(
      admin
        .from("purchase_price_history")
        .select("price_key, price_kg, price_l, price_pz, document_date, supplier_name, description")
        .eq("restaurant_id", restaurantId)
        .in("price_key", part)
        .order("document_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5000),
      "price history",
    );
    for (const h of hist) {
      for (const [base, v] of [["kg", h.price_kg], ["l", h.price_l], ["pz", h.price_pz]] as const) {
        if (v === null || v === undefined) continue;
        push(book, {
          priceKey: h.price_key,
          base,
          pricePerBase: Number(v),
          date: h.document_date,
          source: "invoice",
          supplierName: h.supplier_name,
          label: h.description,
        });
      }
    }
  }

  // Catalog prices (c:<catalog>:<name>).
  const catalogIds = [...new Set(unique.filter((k) => k.startsWith("c:")).map((k) => k.split(":")[1]!))];
  for (const part of chunks(catalogIds, 50)) {
    const items = await rows<{ catalog_id: string; product_name: string; unit: string; price: number }>(
      admin.from("restaurant_catalog_items").select("catalog_id, product_name, unit, price").in("catalog_id", part).limit(20000),
      "catalog items",
    );
    const wanted = new Set(unique);
    for (const it of items) {
      const key = priceKeyForCatalog(it.catalog_id, it.product_name);
      if (!wanted.has(key)) continue;
      const bases = basePrices(Number(it.price), it.unit, it.product_name);
      for (const base of ["kg", "l", "pz"] as const) {
        const v = bases[base];
        if (v !== undefined) push(book, { priceKey: key, base, pricePerBase: v, date: null, source: "catalog", label: it.product_name });
      }
    }
  }

  // Platform supplier listino (p:<product>).
  const productIds = unique.filter((k) => k.startsWith("p:")).map((k) => k.slice(2));
  for (const part of chunks(productIds)) {
    const prods = await rows<{ id: string; name: string; unit: string; price: number; packaging_size: number | null; packaging_unit: string | null }>(
      admin.from("products").select("id, name, unit, price, packaging_size, packaging_unit").in("id", part),
      "products",
    );
    for (const p of prods) {
      const bases = basePrices(Number(p.price), p.unit, p.name, { packagingSize: p.packaging_size, packagingUnit: p.packaging_unit });
      for (const base of ["kg", "l", "pz"] as const) {
        const v = bases[base];
        if (v !== undefined) push(book, { priceKey: `p:${p.id}`, base, pricePerBase: v, date: null, source: "listino", label: p.name });
      }
    }
  }
  return book;
}

export interface FoodCostState {
  recipes: RecipeRow[];
  ingredients: IngredientRow[];
  inputs: RecipeInput[];
  costs: Map<string, RecipeCost>;
  book: PriceBook;
}

export async function computeFoodCost(db: Db, restaurantId: string): Promise<FoodCostState> {
  const { recipes, ingredients } = await loadRecipes(db, restaurantId);
  const inputs = toRecipeInputs(recipes, ingredients);
  const book = await loadPriceBook(
    restaurantId,
    ingredients.map((i) => i.price_key ?? ""),
  );
  return { recipes, ingredients, inputs, costs: costRecipes(inputs, book), book };
}

/**
 * Recompute every recipe, store a snapshot when the cost changed and raise
 * alerts for dishes that crossed their target food-cost %. Uses `db` for the
 * writes (user client under RLS, or service role for jobs).
 */
export async function recomputeFoodCost(db: Db, restaurantId: string): Promise<FoodCostAlert[]> {
  const state = await computeFoodCost(db, restaurantId);
  if (state.inputs.length === 0) return [];
  const ids = state.inputs.map((r) => r.id);
  const snaps = new Map<string, CostSnapshot>();
  for (const part of chunks(ids, 100)) {
    const latest = await rows<{ recipe_id: string; snapshot: CostSnapshot; computed_at: string }>(
      db
        .from("recipe_cost_snapshots")
        .select("recipe_id, snapshot, computed_at")
        .in("recipe_id", part)
        .order("computed_at", { ascending: false })
        .limit(part.length * 5),
      "snapshots",
    );
    for (const s of latest) if (!snaps.has(s.recipe_id)) snaps.set(s.recipe_id, s.snapshot);
  }

  const alerts: FoodCostAlert[] = [];
  const now = new Date().toISOString();
  for (const recipe of state.inputs) {
    const cost = state.costs.get(recipe.id);
    if (!cost) continue;
    const curr = snapshotOf(cost);
    const prev = snaps.get(recipe.id) ?? null;
    const changed =
      !prev ||
      Math.abs((prev.costPerPortion ?? 0) - curr.costPerPortion) > 0.0001 ||
      (prev.foodCostPct ?? -1) !== (curr.foodCostPct ?? -1);
    if (!changed) continue;
    await db.from("recipe_cost_snapshots").insert({
      recipe_id: recipe.id,
      restaurant_id: restaurantId,
      cost_per_portion: curr.costPerPortion,
      food_cost_pct: curr.foodCostPct,
      snapshot: curr,
    });
    await db
      .from("recipes")
      .update({ last_cost_per_portion: curr.costPerPortion, last_food_cost_pct: curr.foodCostPct, last_costed_at: now })
      .eq("id", recipe.id);
    if (recipe.kind !== "dish") continue;
    const alert = detectCrossing(recipe, prev, curr);
    if (alert) {
      alerts.push(alert);
      await db.from("food_cost_alerts").insert({
        restaurant_id: restaurantId,
        recipe_id: recipe.id,
        from_pct: alert.fromPct,
        to_pct: alert.toPct,
        target_pct: alert.targetPct,
        driver_name: alert.driverName,
        driver_change_pct: alert.driverChangePct,
        message: alert.message.slice(0, 500),
      });
    }
  }
  return alerts;
}
