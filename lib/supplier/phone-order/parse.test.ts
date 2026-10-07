import { test } from "node:test";
import assert from "node:assert/strict";
import { extractQuantity, parseOrderText, splitLines } from "./parse.ts";

const catalog = [
  { id: "datterino", name: "Pomodoro datterino", unit: "kg" },
  { id: "zucchine", name: "Zucchine romanesche", unit: "kg" },
  { id: "bufala", name: "Mozzarella di bufala campana DOP 250g", unit: "pz" },
  { id: "acqua", name: "Acqua naturale 1L", unit: "bottiglia" },
  { id: "ciliegino", name: "Pomodoro ciliegino", unit: "kg" },
  { id: "basilico", name: "Basilico", unit: "kg" },
];

test("splits a WhatsApp message into lines", () => {
  assert.deepEqual(splitLines("5 kg pomodori\n- 2 casse zucchine, mozzarella x3"), [
    "5 kg pomodori",
    "2 casse zucchine",
    "mozzarella x3",
  ]);
});

test("extracts quantity and unit in any position", () => {
  assert.deepEqual(extractQuantity("5 kg pomodori"), { quantity: 5, unitHint: "kg", rest: "pomodori" });
  assert.deepEqual(extractQuantity("mozzarella x3"), { quantity: 3, unitHint: null, rest: "mozzarella" });
  assert.equal(extractQuantity("acqua naturale 24 bott.").quantity, 24);
  assert.equal(extractQuantity("acqua naturale 24 bott.").unitHint, "bottiglia");
  assert.equal(extractQuantity("1,5 kg basilico").quantity, 1.5);
  assert.equal(extractQuantity("basilico").quantity, 1);
});

test("matches products with plural/singular and extra words", () => {
  const lines = parseOrderText(
    "Ciao! domani mi servono:\n5 kg pomodori datterini\n2 casse zucchine, mozzarella bufala x3\n- 500 g basilico\nacqua naturale 24 bott.\nqualcosa di strano",
    catalog,
  );
  const byRaw = Object.fromEntries(lines.map((l) => [l.raw, l]));
  assert.equal(byRaw["5 kg pomodori datterini"]?.productId, "datterino");
  assert.equal(byRaw["5 kg pomodori datterini"]?.quantity, 5);
  assert.equal(byRaw["2 casse zucchine"]?.productId, "zucchine");
  assert.equal(byRaw["mozzarella bufala x3"]?.productId, "bufala");
  assert.equal(byRaw["mozzarella bufala x3"]?.quantity, 3);
  // 500 g of a product sold by the kg → 0.5
  assert.equal(byRaw["500 g basilico"]?.productId, "basilico");
  assert.equal(byRaw["500 g basilico"]?.quantity, 0.5);
  assert.equal(byRaw["acqua naturale 24 bott."]?.productId, "acqua");
  assert.equal(byRaw["qualcosa di strano"]?.productId ?? null, null);
});

test("ambiguous line keeps alternatives", () => {
  const [line] = parseOrderText("3 kg pomodoro", catalog);
  assert.ok(line);
  assert.ok(line.productId === "datterino" || line.productId === "ciliegino");
  assert.ok(line.alternatives.length >= 1);
});
