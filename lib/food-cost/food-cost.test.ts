import { test } from "node:test";
import assert from "node:assert/strict";
import { costRecipes, type PriceBook, type RecipeInput } from "./cost.ts";
import { detectCrossing, menuEngineering, snapshotOf, theoreticalConsumption } from "./analysis.ts";

const book = (entries: Array<[string, "kg" | "l" | "pz", number, "invoice" | "catalog"]>): PriceBook => {
  const m: PriceBook = new Map();
  for (const [key, base, price, source] of entries) {
    const list = m.get(key) ?? [];
    list.push({ priceKey: key, base, pricePerBase: price, date: "2026-09-15", source });
    m.set(key, list);
  }
  return m;
};

const carbonara = (): RecipeInput => ({
  id: "carbonara",
  name: "Carbonara",
  kind: "dish",
  portions: 1,
  yieldQty: null,
  yieldUnit: null,
  salePrice: 14,
  vatRate: 10,
  targetFoodCostPct: 30,
  ingredients: [
    { id: "i1", kind: "product", priceKey: "p:spaghetti", subRecipeId: null, name: "Spaghetti", quantity: 120, unit: "g", wastePct: 0, manualPrice: null, manualPriceUnit: null },
    { id: "i2", kind: "product", priceKey: "p:guanciale", subRecipeId: null, name: "Guanciale", quantity: 80, unit: "g", wastePct: 20, manualPrice: null, manualPriceUnit: null },
    { id: "i3", kind: "product", priceKey: "p:uova", subRecipeId: null, name: "Tuorli", quantity: 3, unit: "pz", wastePct: 0, manualPrice: null, manualPriceUnit: null },
    { id: "i4", kind: "manual", priceKey: null, subRecipeId: null, name: "Pecorino", quantity: 40, unit: "g", wastePct: 0, manualPrice: 18, manualPriceUnit: "kg" },
  ],
});

test("dish cost with waste, manual price and food cost % on net price", () => {
  const prices = book([
    ["p:spaghetti", "kg", 2.5, "catalog"],
    ["p:guanciale", "kg", 12, "invoice"],
    ["p:uova", "pz", 0.3, "invoice"],
  ]);
  const c = costRecipes([carbonara()], prices).get("carbonara")!;
  // 0.12×2.5 = 0.30; 0.08×12/0.8 = 1.20; 3×0.30 = 0.90; 0.04×18 = 0.72 → 3.12
  assert.equal(c.totalCost, 3.12);
  assert.equal(c.costPerPortion, 3.12);
  assert.equal(c.netPrice, 12.7273);
  assert.equal(Math.round(c.foodCostPct! * 10) / 10, 24.5);
  assert.equal(c.missingCount, 0);
  assert.equal(c.lines[1]!.source, "invoice");
  assert.equal(c.lines[3]!.source, "manual");
});

test("missing prices and unit mismatches are reported, not guessed", () => {
  const prices = book([["p:spaghetti", "pz", 1, "catalog"]]);
  const c = costRecipes([carbonara()], prices).get("carbonara")!;
  assert.equal(c.missingCount, 3);
  assert.match(c.lines[0]!.missing!, /solo a pz/);
});

test("sub-recipes cost by yield, cycles do not loop", () => {
  const sugo: RecipeInput = {
    id: "sugo",
    name: "Sugo al pomodoro",
    kind: "base",
    portions: 1,
    yieldQty: 2,
    yieldUnit: "kg",
    salePrice: null,
    vatRate: 10,
    targetFoodCostPct: 30,
    ingredients: [
      { id: "s1", kind: "product", priceKey: "p:passata", subRecipeId: null, name: "Passata", quantity: 2.1, unit: "kg", wastePct: 0, manualPrice: null, manualPriceUnit: null },
      { id: "s2", kind: "manual", priceKey: null, subRecipeId: null, name: "Olio", quantity: 100, unit: "ml", wastePct: 0, manualPrice: 9, manualPriceUnit: "l" },
    ],
  };
  const pasta: RecipeInput = {
    ...carbonara(),
    id: "pomodoro",
    name: "Spaghetti al pomodoro",
    salePrice: 11,
    ingredients: [
      { id: "p1", kind: "product", priceKey: "p:spaghetti", subRecipeId: null, name: "Spaghetti", quantity: 120, unit: "g", wastePct: 0, manualPrice: null, manualPriceUnit: null },
      { id: "p2", kind: "sub_recipe", priceKey: null, subRecipeId: "sugo", name: "Sugo", quantity: 150, unit: "g", wastePct: 0, manualPrice: null, manualPriceUnit: null },
    ],
  };
  const prices = book([
    ["p:passata", "kg", 2, "invoice"],
    ["p:spaghetti", "kg", 2.5, "catalog"],
  ]);
  const costs = costRecipes([sugo, pasta], prices);
  // sugo: 4.20 + 0.90 = 5.10 for 2 kg → 2.55 €/kg
  assert.deepEqual(costs.get("sugo")!.costPerYieldBase, { base: "kg", price: 2.55 });
  // pasta: 0.30 + 0.15 × 2.55 = 0.6825
  assert.equal(costs.get("pomodoro")!.costPerPortion, 0.6825);

  const loopA: RecipeInput = { ...sugo, id: "a", ingredients: [{ ...pasta.ingredients[1]!, id: "x", subRecipeId: "b" }] };
  const loopB: RecipeInput = { ...sugo, id: "b", ingredients: [{ ...pasta.ingredients[1]!, id: "y", subRecipeId: "a" }] };
  const loops = costRecipes([loopA, loopB], prices);
  assert.ok(loops.get("a")!.missingCount + loops.get("b")!.missingCount >= 1);

  const consumption = theoreticalConsumption([{ recipeId: "pomodoro", portions: 10 }], [sugo, pasta], costs);
  const passata = consumption.find((r) => r.priceKey === "p:passata")!;
  assert.equal(Math.round(passata.qty * 1000) / 1000, 1.575); // 10 × 0.15 kg / 2 kg × 2.1 kg
  const spaghetti = consumption.find((r) => r.priceKey === "p:spaghetti")!;
  assert.equal(Math.round(spaghetti.qty * 1000) / 1000, 1.2);
});

test("alert when a dish crosses its target because an ingredient rose", () => {
  const r = carbonara();
  const before = costRecipes([r], book([["p:spaghetti", "kg", 2.5, "catalog"], ["p:guanciale", "kg", 12, "invoice"], ["p:uova", "pz", 0.3, "invoice"]])).get("carbonara")!;
  const after = costRecipes([r], book([["p:spaghetti", "kg", 2.5, "catalog"], ["p:guanciale", "kg", 14.16, "invoice"], ["p:uova", "pz", 0.45, "invoice"]])).get("carbonara")!;
  // Lower the target so the rise crosses it.
  const alert = detectCrossing({ ...r, targetFoodCostPct: 26 }, snapshotOf(before), snapshotOf(after));
  assert.ok(alert);
  assert.equal(alert!.driverName, "Tuorli");
  assert.equal(alert!.driverChangePct, 50);
  assert.match(alert!.message, /^Carbonara è passata dal 25% al 30%: tuorli \+50% \(obiettivo 26%\)\.$/);
  assert.equal(detectCrossing(r, snapshotOf(after), snapshotOf(after)), null);
});

test("menu engineering quadrants", () => {
  const { items, marginThreshold } = menuEngineering([
    { recipeId: "a", name: "Carbonara", qtySold: 300, revenueNet: 300 * 12.73, costPerPortion: 3.1 },
    { recipeId: "b", name: "Tagliata", qtySold: 80, revenueNet: 80 * 20, costPerPortion: 8 },
    { recipeId: "c", name: "Insalatona", qtySold: 260, revenueNet: 260 * 9, costPerPortion: 4.5 },
    { recipeId: "d", name: "Zuppa", qtySold: 20, revenueNet: 20 * 8, costPerPortion: 4 },
  ]);
  const klass = Object.fromEntries(items.map((i) => [i.name, i.klass]));
  assert.ok(marginThreshold > 0);
  assert.equal(klass["Carbonara"], "star");
  assert.equal(klass["Tagliata"], "puzzle");
  assert.equal(klass["Insalatona"], "plowhorse");
  assert.equal(klass["Zuppa"], "dog");
});
