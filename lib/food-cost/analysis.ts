// lib/food-cost/analysis.ts
// Food-cost alerts, menu engineering and theoretical consumption (pure).

import { toBase, type BaseUnit } from "../invoices/units.ts";
import { normalizeText, productSimilarity } from "../invoices/text.ts";
import type { RecipeCost, RecipeInput } from "./cost.ts";

/* ------------------------------------------------------------------ */
/* Alerts                                                               */
/* ------------------------------------------------------------------ */

export interface CostSnapshot {
  foodCostPct: number | null;
  costPerPortion: number;
  /** ingredientId → { name, cost } at snapshot time. */
  ingredients: Record<string, { name: string; cost: number | null; unitCost: number | null }>;
}

export interface FoodCostAlert {
  recipeId: string;
  recipeName: string;
  fromPct: number;
  toPct: number;
  targetPct: number;
  driverName: string | null;
  driverChangePct: number | null;
  message: string;
}

const fmtPct = (n: number) => `${Math.round(n)}%`;

export function snapshotOf(cost: RecipeCost): CostSnapshot {
  const ingredients: CostSnapshot["ingredients"] = {};
  for (const l of cost.lines) ingredients[l.ingredientId] = { name: l.name, cost: l.cost, unitCost: l.unitCost };
  return { foodCostPct: cost.foodCostPct, costPerPortion: cost.costPerPortion, ingredients };
}

/**
 * Alert when a dish crosses its target food-cost % upwards between two
 * snapshots. The driver is the ingredient whose cost grew the most.
 */
export function detectCrossing(recipe: RecipeInput, prev: CostSnapshot | null, curr: CostSnapshot): FoodCostAlert | null {
  if (!prev || prev.foodCostPct === null || curr.foodCostPct === null) return null;
  const target = recipe.targetFoodCostPct;
  if (!(prev.foodCostPct <= target && curr.foodCostPct > target)) return null;
  let driver: { name: string; delta: number; pct: number | null } | null = null;
  for (const [id, now] of Object.entries(curr.ingredients)) {
    const before = prev.ingredients[id];
    if (!before || before.cost === null || now.cost === null) continue;
    const delta = now.cost - before.cost;
    if (delta <= 0) continue;
    const pct =
      before.unitCost && now.unitCost && before.unitCost > 0 ? ((now.unitCost - before.unitCost) / before.unitCost) * 100 : null;
    if (!driver || delta > driver.delta) driver = { name: now.name, delta, pct };
  }
  const driverText = driver ? `: ${driver.name.toLowerCase()} ${driver.pct !== null ? `+${Math.round(driver.pct)}%` : "più caro"}` : "";
  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    fromPct: Math.round(prev.foodCostPct * 10) / 10,
    toPct: Math.round(curr.foodCostPct * 10) / 10,
    targetPct: target,
    driverName: driver?.name ?? null,
    driverChangePct: driver?.pct !== undefined && driver?.pct !== null ? Math.round(driver.pct * 10) / 10 : null,
    message: `${recipe.name} è passata dal ${fmtPct(prev.foodCostPct)} al ${fmtPct(curr.foodCostPct)}${driverText} (obiettivo ${fmtPct(target)}).`,
  };
}

/* ------------------------------------------------------------------ */
/* Menu engineering (Kasavana & Smith)                                  */
/* ------------------------------------------------------------------ */

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export const MENU_CLASS_LABELS: Record<MenuClass, { label: string; hint: string }> = {
  star: { label: "Star", hint: "Popolare e redditizio: tienilo in evidenza." },
  plowhorse: { label: "Cavallo da tiro", hint: "Si vende molto ma rende poco: rivedi porzione o prezzo." },
  puzzle: { label: "Enigma", hint: "Rende bene ma si vende poco: spingilo in sala o in carta." },
  dog: { label: "Da rivedere", hint: "Poco venduto e poco redditizio: valuta di toglierlo." },
};

export interface MenuItemInput {
  recipeId: string;
  name: string;
  qtySold: number;
  /** Net (ex VAT) revenue from POS for the item in the period. */
  revenueNet: number;
  costPerPortion: number;
}

export interface MenuItemResult extends MenuItemInput {
  avgNetPrice: number;
  unitMargin: number;
  totalMargin: number;
  popularityShare: number;
  foodCostPct: number | null;
  klass: MenuClass;
}

export function menuEngineering(items: MenuItemInput[]): {
  items: MenuItemResult[];
  popularityThreshold: number;
  marginThreshold: number;
} {
  const sold = items.filter((i) => i.qtySold > 0);
  const totalQty = sold.reduce((s, i) => s + i.qtySold, 0);
  const n = sold.length;
  const popularityThreshold = n > 0 ? 0.7 / n : 0;
  const withMargin = sold.map((i) => {
    const avgNetPrice = i.revenueNet / i.qtySold;
    const unitMargin = avgNetPrice - i.costPerPortion;
    return { ...i, avgNetPrice, unitMargin, totalMargin: unitMargin * i.qtySold };
  });
  const marginThreshold = totalQty > 0 ? withMargin.reduce((s, i) => s + i.totalMargin, 0) / totalQty : 0;
  const out: MenuItemResult[] = withMargin.map((i) => {
    const share = totalQty > 0 ? i.qtySold / totalQty : 0;
    const popular = share >= popularityThreshold;
    const profitable = i.unitMargin >= marginThreshold;
    return {
      ...i,
      popularityShare: share,
      foodCostPct: i.avgNetPrice > 0 ? (i.costPerPortion / i.avgNetPrice) * 100 : null,
      klass: popular ? (profitable ? "star" : "plowhorse") : profitable ? "puzzle" : "dog",
    };
  });
  out.sort((a, b) => b.totalMargin - a.totalMargin);
  return { items: out, popularityThreshold, marginThreshold };
}

/* ------------------------------------------------------------------ */
/* Theoretical consumption                                              */
/* ------------------------------------------------------------------ */

export interface ConsumptionRow {
  priceKey: string;
  name: string;
  base: BaseUnit;
  qty: number;
  cost: number;
}

/**
 * Explode sales (portions per recipe) into ingredient quantities, following
 * sub-recipes proportionally to their yield. Ingredient quantities are gross
 * of waste (what has to be bought).
 */
export function theoreticalConsumption(
  sales: Array<{ recipeId: string; portions: number }>,
  recipes: RecipeInput[],
  costs: Map<string, RecipeCost>,
): ConsumptionRow[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const acc = new Map<string, ConsumptionRow>();

  const explode = (recipeId: string, multiplier: number, depth: number) => {
    const r = byId.get(recipeId);
    if (!r || depth > 8 || multiplier <= 0) return;
    const cost = costs.get(recipeId);
    for (const ing of r.ingredients) {
      const q = toBase(ing.quantity, ing.unit);
      if (!q) continue;
      const waste = 1 / (1 - Math.min(95, Math.max(0, ing.wastePct || 0)) / 100);
      const qty = q.qty * multiplier * waste;
      if (ing.kind === "sub_recipe" && ing.subRecipeId) {
        const sub = byId.get(ing.subRecipeId);
        if (!sub) continue;
        const y = sub.yieldQty && sub.yieldUnit ? toBase(sub.yieldQty, sub.yieldUnit) : null;
        const yieldQty = y && y.base === q.base ? y.qty : sub.portions > 0 ? sub.portions : 1;
        explode(sub.id, qty / yieldQty, depth + 1);
        continue;
      }
      const key = ing.priceKey ?? `manual:${normalizeText(ing.name)}`;
      const line = cost?.lines.find((l) => l.ingredientId === ing.id);
      const unitCost = line?.unitCost ?? 0;
      const k = `${key}|${q.base}`;
      const row = acc.get(k) ?? { priceKey: key, name: ing.name, base: q.base, qty: 0, cost: 0 };
      row.qty += qty;
      row.cost += qty * unitCost;
      acc.set(k, row);
    }
  };

  for (const s of sales) {
    const r = byId.get(s.recipeId);
    if (!r) continue;
    explode(s.recipeId, s.portions / (r.portions > 0 ? r.portions : 1), 0);
  }
  return [...acc.values()].sort((a, b) => b.cost - a.cost);
}

/** Normalised POS item name used to link sales to recipes. */
export function posNameKey(name: string): string {
  return normalizeText(name);
}

/** Suggest recipe ↔ POS item links by name similarity (pure, no write). */
export function suggestPosLinks(names: string[], recipes: Array<{ id: string; name: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of names.slice(0, 500)) {
    let best: { id: string; s: number } | null = null;
    for (const r of recipes) {
      const s = normalizeText(n) === normalizeText(r.name) ? 1 : productSimilarity(n, r.name);
      if (!best || s > best.s) best = { id: r.id, s };
    }
    if (best && best.s >= 0.75) out[n] = best.id;
  }
  return out;
}
