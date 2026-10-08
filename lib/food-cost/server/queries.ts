// lib/food-cost/server/queries.ts
// Read models of Finanze → Food cost (ricette, menu engineering).

import "server-only";
import { addDaysIso, isoDate, rows, type Db } from "@/lib/invoices/server/db";
import { toBase } from "@/lib/invoices/units";
import { menuEngineering, posNameKey, theoreticalConsumption, type MenuItemResult } from "../analysis";
import type { PricePoint, RecipeCost } from "../cost";
import { computeFoodCost, type IngredientRow, type RecipeRow } from "./engine";

export interface RecipeListItem {
  id: string;
  name: string;
  kind: "dish" | "base";
  category: string | null;
  salePrice: number | null;
  targetPct: number;
  costPerPortion: number;
  foodCostPct: number | null;
  margin: number | null;
  missingCount: number;
  ingredientsCount: number;
  overTarget: boolean;
}

export interface FoodCostAlertRow {
  id: string;
  recipe_id: string;
  message: string;
  from_pct: number;
  to_pct: number;
  target_pct: number;
  created_at: string;
}

export async function getFoodCostOverview(db: Db, restaurantId: string) {
  const state = await computeFoodCost(db, restaurantId);
  const items: RecipeListItem[] = state.recipes.map((r) => {
    const c = state.costs.get(r.id);
    const pct = c?.foodCostPct ?? null;
    return {
      id: r.id,
      name: r.name,
      kind: r.kind,
      category: r.category,
      salePrice: r.sale_price !== null ? Number(r.sale_price) : null,
      targetPct: Number(r.target_food_cost_pct),
      costPerPortion: c?.costPerPortion ?? 0,
      foodCostPct: pct,
      margin: c?.margin ?? null,
      missingCount: c?.missingCount ?? 0,
      ingredientsCount: state.ingredients.filter((i) => i.recipe_id === r.id).length,
      overTarget: pct !== null && pct > Number(r.target_food_cost_pct),
    };
  });
  const alerts = await rows<FoodCostAlertRow>(
    db
      .from("food_cost_alerts")
      .select("id, recipe_id, message, from_pct, to_pct, target_pct, created_at")
      .eq("restaurant_id", restaurantId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    "alerts",
  );
  const dishes = items.filter((i) => i.kind === "dish" && i.foodCostPct !== null);
  const avgPct = dishes.length > 0 ? dishes.reduce((s, d) => s + (d.foodCostPct ?? 0), 0) / dishes.length : null;
  return { items, alerts, avgPct, overTarget: dishes.filter((d) => d.overTarget).length };
}

export interface RecipeEditorData {
  recipe: RecipeRow | null;
  ingredients: IngredientRow[];
  cost: RecipeCost | null;
  subRecipes: Array<{
    id: string;
    name: string;
    yieldUnit: string | null;
    /** € per kg / l / pz of yield (null when it cannot be costed). */
    costPerYieldBase: { base: "kg" | "l" | "pz"; price: number } | null;
    missingCount: number;
  }>;
  usedIn: Array<{ id: string; name: string }>;
  /** Price points of the ingredients in use (for the live preview). */
  book: Record<string, PricePoint[]>;
  categories: string[];
}

export async function getRecipeEditor(db: Db, restaurantId: string, id: string | null): Promise<RecipeEditorData> {
  const state = await computeFoodCost(db, restaurantId);
  const recipe = id ? state.recipes.find((r) => r.id === id) ?? null : null;
  return {
    recipe,
    ingredients: recipe ? state.ingredients.filter((i) => i.recipe_id === recipe.id) : [],
    cost: recipe ? state.costs.get(recipe.id) ?? null : null,
    subRecipes: state.recipes
      .filter((r) => r.kind === "base" && r.id !== id)
      .map((r) => {
        const c = state.costs.get(r.id);
        return {
          id: r.id,
          name: r.name,
          yieldUnit: r.yield_unit,
          costPerYieldBase: c?.costPerYieldBase ?? null,
          missingCount: c?.missingCount ?? 0,
        };
      }),
    usedIn: recipe
      ? state.recipes
          .filter((r) => state.ingredients.some((i) => i.recipe_id === r.id && i.sub_recipe_id === recipe.id))
          .map((r) => ({ id: r.id, name: r.name }))
      : [],
    book: Object.fromEntries(
      [...new Set((recipe ? state.ingredients.filter((i) => i.recipe_id === recipe.id) : []).map((i) => i.price_key).filter((k): k is string => !!k))]
        .filter((k) => state.book.has(k))
        .map((k) => [k, state.book.get(k)!]),
    ),
    categories: [...new Set(state.recipes.map((r) => r.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "it")),
  };
}

/* ------------------------------------------------------------------ */
/* Menu engineering + theoretical vs actual                             */
/* ------------------------------------------------------------------ */

export interface PosSaleRow {
  name: string;
  key: string;
  qty: number;
  grossCents: number;
  netCents: number;
  linkedRecipeId: string | null;
  portionsPerSale: number;
}

export interface MenuAnalysis {
  period: { from: string; to: string };
  posAvailable: boolean;
  posError: string | null;
  sales: PosSaleRow[];
  revenueNetCents: number;
  linkedRevenueNetCents: number;
  menu: MenuItemResult[];
  marginThreshold: number;
  theoreticalCostCents: number;
  theoreticalPct: number | null;
  purchasesCents: number;
  actualPct: number | null;
  consumption: Array<{ priceKey: string; name: string; base: string; theoretical: number; purchased: number | null; cost: number }>;
  recipes: Array<{ id: string; name: string }>;
}

export async function getMenuAnalysis(db: Db, restaurantId: string, days = 30): Promise<MenuAnalysis> {
  const to = isoDate(new Date());
  const from = addDaysIso(to, -days + 1);
  const state = await computeFoodCost(db, restaurantId);

  const { data: salesData, error: salesError } = await db.rpc("food_cost_pos_sales", { _restaurant_id: restaurantId, _from: from, _to: to });
  const links = await rows<{ pos_name_key: string; recipe_id: string; portions_per_sale: number }>(
    db.from("recipe_pos_links").select("pos_name_key, recipe_id, portions_per_sale").eq("restaurant_id", restaurantId),
    "pos links",
  );
  const linkByKey = new Map(links.map((l) => [l.pos_name_key, l]));
  const sales: PosSaleRow[] = ((salesData ?? []) as Array<{ name: string; qty: number; gross_cents: number; net_cents: number }>)
    .map((s) => {
      const key = posNameKey(s.name);
      const link = linkByKey.get(key);
      return {
        name: s.name,
        key,
        qty: Number(s.qty),
        grossCents: Number(s.gross_cents),
        netCents: Number(s.net_cents),
        linkedRecipeId: link?.recipe_id ?? null,
        portionsPerSale: link ? Number(link.portions_per_sale) : 1,
      };
    })
    .sort((a, b) => b.netCents - a.netCents);

  const revenueNetCents = sales.reduce((s, r) => s + r.netCents, 0);
  const linked = sales.filter((s) => s.linkedRecipeId && state.costs.has(s.linkedRecipeId));
  const linkedRevenueNetCents = linked.reduce((s, r) => s + r.netCents, 0);

  // Menu engineering on linked items (aggregated per recipe).
  const perRecipe = new Map<string, { qty: number; net: number }>();
  for (const s of linked) {
    const cur = perRecipe.get(s.linkedRecipeId!) ?? { qty: 0, net: 0 };
    cur.qty += s.qty * s.portionsPerSale;
    cur.net += s.netCents / 100;
    perRecipe.set(s.linkedRecipeId!, cur);
  }
  const me = menuEngineering(
    [...perRecipe.entries()].map(([recipeId, v]) => ({
      recipeId,
      name: state.recipes.find((r) => r.id === recipeId)?.name ?? "Ricetta",
      qtySold: v.qty,
      revenueNet: v.net,
      costPerPortion: state.costs.get(recipeId)?.costPerPortion ?? 0,
    })),
  );

  const theoreticalCost = [...perRecipe.entries()].reduce((s, [rid, v]) => s + v.qty * (state.costs.get(rid)?.costPerPortion ?? 0), 0);
  const theoreticalCostCents = Math.round(theoreticalCost * 100);

  // Purchases from supplier invoices in the period (credit notes subtract).
  const inv = await rows<{ document_type: string; taxable_amount: number }>(
    db
      .from("supplier_invoices")
      .select("document_type, taxable_amount")
      .eq("restaurant_id", restaurantId)
      .gte("document_date", from)
      .lte("document_date", to),
    "period invoices",
  );
  const purchasesCents = inv.reduce(
    (s, r) => s + (r.document_type === "TD04" || r.document_type === "TD08" ? -1 : 1) * Math.round(Number(r.taxable_amount) * 100),
    0,
  );

  // Theoretical consumption vs purchased quantities per product.
  const consumption = theoreticalConsumption(
    [...perRecipe.entries()].map(([recipeId, v]) => ({ recipeId, portions: v.qty })),
    state.inputs,
    state.costs,
  );
  const keys = consumption.map((c) => c.priceKey).filter((k) => !k.startsWith("manual:"));
  const purchasedByKey = new Map<string, Record<string, number>>();
  if (keys.length > 0) {
    const hist = await rows<{ price_key: string; quantity: number | null; unit: string | null; description: string }>(
      db
        .from("purchase_price_history")
        .select("price_key, quantity, unit, description")
        .eq("restaurant_id", restaurantId)
        .in("price_key", keys.slice(0, 300))
        .gte("document_date", from)
        .lte("document_date", to),
      "purchased qty",
    );
    for (const h of hist) {
      const b = h.quantity !== null ? toBase(Number(h.quantity), h.unit) : null;
      if (!b) continue;
      const cur = purchasedByKey.get(h.price_key) ?? {};
      cur[b.base] = (cur[b.base] ?? 0) + b.qty;
      purchasedByKey.set(h.price_key, cur);
    }
  }

  return {
    period: { from, to },
    posAvailable: !salesError,
    posError: salesError ? salesError.message : null,
    sales,
    revenueNetCents,
    linkedRevenueNetCents,
    menu: me.items,
    marginThreshold: me.marginThreshold,
    theoreticalCostCents,
    theoreticalPct: linkedRevenueNetCents > 0 ? (theoreticalCostCents / linkedRevenueNetCents) * 100 : null,
    purchasesCents,
    actualPct: revenueNetCents > 0 && inv.length > 0 ? (purchasesCents / revenueNetCents) * 100 : null,
    consumption: consumption.slice(0, 40).map((c) => ({
      priceKey: c.priceKey,
      name: c.name,
      base: c.base,
      theoretical: c.qty,
      purchased: purchasedByKey.get(c.priceKey)?.[c.base] ?? null,
      cost: c.cost,
    })),
    recipes: state.recipes.filter((r) => r.kind === "dish").map((r) => ({ id: r.id, name: r.name })),
  };
}
