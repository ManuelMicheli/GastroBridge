// lib/food-cost/cost.ts
// Recipe (scheda tecnica) costing — pure and deterministic.
//
// Prices come from a PriceBook built by the server from, in order of
// preference: the latest real purchase price (supplier invoice lines), then
// the catalog / supplier listino price, then a manual price typed in the
// recipe. Every ingredient line reports which source it used.

import { canonicalUnit, toBase, type BaseUnit } from "../invoices/units.ts";

export type PriceSource = "invoice" | "catalog" | "listino" | "manual";

export interface PricePoint {
  priceKey: string;
  base: BaseUnit;
  /** € per kg / l / pz (net of VAT). */
  pricePerBase: number;
  date: string | null;
  source: PriceSource;
  supplierName?: string | null;
  label?: string | null;
}

/** priceKey → available price points (one per base unit, best first). */
export type PriceBook = Map<string, PricePoint[]>;

export interface IngredientInput {
  id: string;
  kind: "product" | "sub_recipe" | "manual";
  priceKey: string | null;
  subRecipeId: string | null;
  name: string;
  quantity: number;
  unit: string;
  /** Scarto %: the recipe quantity is the net (used) quantity. */
  wastePct: number;
  manualPrice: number | null;
  manualPriceUnit: string | null;
}

export interface RecipeInput {
  id: string;
  name: string;
  kind: "dish" | "base";
  /** Portions produced by the ingredient list (dish). */
  portions: number;
  /** Yield of a base recipe (e.g. 2 kg of sugo). */
  yieldQty: number | null;
  yieldUnit: string | null;
  /** Menu price, VAT included. */
  salePrice: number | null;
  vatRate: number;
  targetFoodCostPct: number;
  ingredients: IngredientInput[];
}

export interface IngredientCost {
  ingredientId: string;
  name: string;
  /** € for the quantity in the recipe (gross of waste). */
  cost: number | null;
  /** € per base unit used. */
  unitCost: number | null;
  base: BaseUnit | null;
  source: PriceSource | "sub_recipe" | null;
  priceDate: string | null;
  missing: string | null;
}

export interface RecipeCost {
  recipeId: string;
  totalCost: number;
  costPerPortion: number;
  /** For base recipes: € per kg/l/pz of yield. */
  costPerYieldBase: { base: BaseUnit; price: number } | null;
  netPrice: number | null;
  foodCostPct: number | null;
  margin: number | null;
  missingCount: number;
  lines: IngredientCost[];
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;

export function netSalePrice(r: Pick<RecipeInput, "salePrice" | "vatRate">): number | null {
  if (r.salePrice === null || r.salePrice <= 0) return null;
  return r.salePrice / (1 + (r.vatRate || 0) / 100);
}

function pickPrice(points: PricePoint[] | undefined, base: BaseUnit): PricePoint | null {
  if (!points) return null;
  return points.find((p) => p.base === base) ?? null;
}

function wasteFactor(pct: number): number {
  const w = Math.min(95, Math.max(0, pct || 0));
  return 1 / (1 - w / 100);
}

/**
 * Cost every recipe of the restaurant. Sub-recipes are resolved recursively;
 * cycles are reported as missing prices instead of looping.
 */
export function costRecipes(recipes: RecipeInput[], book: PriceBook): Map<string, RecipeCost> {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const done = new Map<string, RecipeCost>();
  const visiting = new Set<string>();

  const costOf = (id: string): RecipeCost | null => {
    const cached = done.get(id);
    if (cached) return cached;
    const recipe = byId.get(id);
    if (!recipe || visiting.has(id)) return null;
    visiting.add(id);
    const lines: IngredientCost[] = recipe.ingredients.map((ing) => costIngredient(ing, book, costOf));
    visiting.delete(id);

    const totalCost = r4(lines.reduce((s, l) => s + (l.cost ?? 0), 0));
    const portions = recipe.portions > 0 ? recipe.portions : 1;
    const costPerPortion = r4(totalCost / portions);
    let costPerYieldBase: RecipeCost["costPerYieldBase"] = null;
    if (recipe.yieldQty && recipe.yieldQty > 0 && recipe.yieldUnit) {
      const y = toBase(recipe.yieldQty, recipe.yieldUnit);
      if (y && y.qty > 0) costPerYieldBase = { base: y.base, price: r4(totalCost / y.qty) };
    }
    if (!costPerYieldBase) costPerYieldBase = { base: "pz", price: costPerPortion };
    const netPrice = netSalePrice(recipe);
    const foodCostPct = netPrice ? r4((costPerPortion / netPrice) * 100) : null;
    const result: RecipeCost = {
      recipeId: id,
      totalCost,
      costPerPortion,
      costPerYieldBase,
      netPrice: netPrice !== null ? r4(netPrice) : null,
      foodCostPct,
      margin: netPrice !== null ? r4(netPrice - costPerPortion) : null,
      missingCount: lines.filter((l) => l.missing).length,
      lines,
    };
    done.set(id, result);
    return result;
  };

  for (const r of recipes) costOf(r.id);
  return done;
}

function costIngredient(
  ing: IngredientInput,
  book: PriceBook,
  costOf: (id: string) => RecipeCost | null,
): IngredientCost {
  const base: IngredientCost = {
    ingredientId: ing.id,
    name: ing.name,
    cost: null,
    unitCost: null,
    base: null,
    source: null,
    priceDate: null,
    missing: null,
  };
  const qty = toBase(ing.quantity, ing.unit);
  if (!qty) {
    return { ...base, missing: `Unità "${ing.unit}" non convertibile (usa g, kg, ml, l o pz)` };
  }
  const factor = wasteFactor(ing.wastePct);

  if (ing.kind === "sub_recipe" && ing.subRecipeId) {
    const sub = costOf(ing.subRecipeId);
    if (!sub) return { ...base, base: qty.base, missing: "Semilavorato non trovato o ricorsivo" };
    const y = sub.costPerYieldBase;
    if (!y || y.base !== qty.base) {
      return { ...base, base: qty.base, missing: `La resa del semilavorato è in ${y?.base ?? "—"}, la dose in ${qty.base}` };
    }
    const cost = r4(qty.qty * y.price * factor);
    return { ...base, cost, unitCost: y.price, base: qty.base, source: "sub_recipe", missing: sub.missingCount > 0 ? "Semilavorato con prezzi mancanti" : null };
  }

  if (ing.priceKey) {
    const p = pickPrice(book.get(ing.priceKey), qty.base);
    if (p) {
      return {
        ...base,
        cost: r4(qty.qty * p.pricePerBase * factor),
        unitCost: r4(p.pricePerBase),
        base: qty.base,
        source: p.source,
        priceDate: p.date,
      };
    }
  }

  if (ing.manualPrice !== null && ing.manualPrice >= 0 && ing.manualPriceUnit) {
    const per = toBase(1, ing.manualPriceUnit);
    if (per && per.base === qty.base) {
      const pricePerBase = ing.manualPrice / per.qty;
      return { ...base, cost: r4(qty.qty * pricePerBase * factor), unitCost: r4(pricePerBase), base: qty.base, source: "manual" };
    }
  }
  const hasOther = ing.priceKey ? (book.get(ing.priceKey) ?? []).map((p) => p.base) : [];
  return {
    ...base,
    base: qty.base,
    missing:
      hasOther.length > 0
        ? `Prezzo disponibile solo a ${hasOther.join("/")}: esprimi la dose in ${hasOther[0]}`
        : "Nessun prezzo: collega un prodotto acquistato o inserisci un prezzo",
  };
}

/** Human label of a quantity unit ("g" → "g", "KGM" → "kg"). */
export function unitLabel(raw: string): string {
  const u = canonicalUnit(raw);
  return u.code || raw;
}
