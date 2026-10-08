import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCadence, fallOffProducts, similarClientSuggestions } from "./cadence.ts";

const NOW = new Date("2026-10-08T10:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

test("weekly client that skipped two weeks is at risk", () => {
  const orders = [30, 23, 16, 9].map((d) => ({ restaurantId: "r1", createdAt: daysAgo(d + 14), subtotal: 300 }));
  const c = computeCadence(["r1"], orders, NOW).get("r1")!;
  assert.equal(c.cadenceDays, 7);
  assert.equal(c.daysSinceLast, 23);
  assert.equal(c.status, "a_rischio");
  assert.ok(c.daysLate > 0);
  assert.ok(c.riskScore > 0);
});

test("regular client stays regular, same-day orders count once", () => {
  const orders = [21, 14, 7, 7, 2].map((d) => ({ restaurantId: "r2", createdAt: daysAgo(d), subtotal: 100 }));
  const c = computeCadence(["r2"], orders, NOW).get("r2")!;
  assert.equal(c.ordersCount, 4);
  assert.equal(c.status, "regolare");
  assert.equal(c.riskScore, 0);
});

test("clients with fewer than 3 order days are new; >60 days is dormant", () => {
  const m = computeCadence(
    ["n", "d", "none"],
    [
      { restaurantId: "n", createdAt: daysAgo(3), subtotal: 50 },
      { restaurantId: "d", createdAt: daysAgo(90), subtotal: 50 },
      { restaurantId: "d", createdAt: daysAgo(80), subtotal: 50 },
      { restaurantId: "d", createdAt: daysAgo(70), subtotal: 50 },
    ],
    NOW,
  );
  assert.equal(m.get("n")!.status, "nuovo");
  assert.equal(m.get("d")!.status, "dormiente");
  assert.equal(m.get("none")!.ordersCount, 0);
});

test("fall-off products and similar-client suggestions use real co-purchases", () => {
  const lines = [
    // r1 bought A twice 2-3 months ago, B recently
    { restaurantId: "r1", productId: "A", orderedAt: daysAgo(80), quantity: 1 },
    { restaurantId: "r1", productId: "A", orderedAt: daysAgo(60), quantity: 1 },
    { restaurantId: "r1", productId: "B", orderedAt: daysAgo(5), quantity: 1 },
    { restaurantId: "r1", productId: "C", orderedAt: daysAgo(5), quantity: 1 },
    // r2 similar (B, C) also buys D
    { restaurantId: "r2", productId: "B", orderedAt: daysAgo(5), quantity: 1 },
    { restaurantId: "r2", productId: "C", orderedAt: daysAgo(5), quantity: 1 },
    { restaurantId: "r2", productId: "D", orderedAt: daysAgo(5), quantity: 1 },
    // r3 not similar (only one shared product)
    { restaurantId: "r3", productId: "B", orderedAt: daysAgo(5), quantity: 1 },
    { restaurantId: "r3", productId: "E", orderedAt: daysAgo(5), quantity: 1 },
  ];
  assert.deepEqual(
    fallOffProducts("r1", lines, NOW).map((f) => f.productId),
    ["A"],
  );
  assert.deepEqual(
    similarClientSuggestions("r1", lines).map((s) => s.productId),
    ["D"],
  );
});
