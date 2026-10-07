import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLine, parseShoppingList } from "./quick-parse.ts";
import { matchLine, toMatchable, convertQty } from "./quick-match.ts";
import { normalizedUnitPrice, packSize } from "./units.ts";
import { nextDeadline, previousDeadlineMs, romeWallTimeToUtc } from "./schedule.ts";
import { reorderStats, suggestedQty } from "./predict.ts";
import { productTokens, matchScore } from "./text.ts";

test("parseLine: leading quantity, unit and filler", () => {
  const l = parseLine("2 kg di datterini")!;
  assert.equal(l.qty, 2);
  assert.equal(l.unit, "kg");
  assert.equal(l.text, "datterini");
  assert.equal(l.explicitQty, true);
});

test("parseLine: glued unit, words and trailing quantity", () => {
  assert.deepEqual(
    { q: parseLine("1,5kg mozzarella")!.qty, u: parseLine("1,5kg mozzarella")!.unit },
    { q: 1.5, u: "kg" },
  );
  const c = parseLine("una cassa limoni")!;
  assert.equal(c.qty, 1);
  assert.equal(c.unit, "cassa");
  assert.equal(c.text, "limoni");
  const t = parseLine("datterini 3 kg")!;
  assert.equal(t.qty, 3);
  assert.equal(t.text, "datterini");
  const x = parseLine("bufala x6")!;
  assert.equal(x.qty, 6);
  assert.equal(x.text, "bufala");
  const none = parseLine("prezzemolo")!;
  assert.equal(none.qty, 1);
  assert.equal(none.explicitQty, false);
});

test("parseShoppingList splits on commas but keeps decimals", () => {
  const lines = parseShoppingList("2 kg datterini, 1,5 kg vongole\n- 3 mozzarelle; mezzo kg burro");
  assert.deepEqual(lines.map((l) => [l.qty, l.text]), [
    [2, "datterini"],
    [1.5, "vongole"],
    [3, "mozzarelle"],
    [0.5, "burro"],
  ]);
});

test("pack sizes and normalized prices", () => {
  assert.deepEqual(packSize("Mozzarella fiordilatte 125g x 8", "cf"), { measure: "kg", amount: 1 });
  assert.deepEqual(packSize("Acqua naturale 6x1,5l", "fardello"), { measure: "l", amount: 9 });
  assert.deepEqual(packSize("Olio EVO latta 5 l", "pz"), { measure: "l", amount: 5 });
  assert.deepEqual(packSize("Pomodoro datterino", "kg"), { measure: "kg", amount: 1 });
  assert.equal(packSize("Limoni", "cassa"), null);
  const p = normalizedUnitPrice("Burro 250 g", "pz", 2.5)!;
  assert.equal(p.measure, "kg");
  assert.ok(Math.abs(p.price - 10) < 1e-9);
});

test("tokens fold plurals; matching prefers the head word", () => {
  assert.deepEqual(productTokens("Pomodori datterini 5kg"), ["pomodor", "datterin"]);
  const q = productTokens("datterini");
  assert.ok(matchScore(q, productTokens("Pomodoro datterino")) >= 0.55);
  assert.ok(matchScore(productTokens("limoni"), productTokens("Lime")) < 0.55);
});

test("matchLine picks the offer already bought, converts kg to packs", () => {
  const offers = toMatchable([
    { key: "a", name: "Mozzarella fiordilatte 125g", unit: "pz", price: 1, supplierKey: "s1", supplierName: "A", timesOrdered: 0 },
    { key: "b", name: "Mozzarella fiordilatte 1kg", unit: "pz", price: 7.5, supplierKey: "s2", supplierName: "B", timesOrdered: 4 },
    { key: "c", name: "Limoni Amalfi", unit: "kg", price: 3, supplierKey: "s1", supplierName: "A", timesOrdered: 0 },
  ]);
  const { best } = matchLine({ text: "mozzarelle fiordilatte", qty: 2, unit: "kg" }, offers);
  assert.equal(best?.offer.key, "b");
  assert.equal(best?.qty, 2);
  const conv = convertQty({ qty: 1, unit: "kg" }, { name: "Mozzarella 125g", unit: "pz" });
  assert.equal(conv.qty, 8);
  assert.equal(matchLine({ text: "vongole", qty: 1, unit: null }, offers).best, null);
});

test("nextDeadline: order by 18:00 for tomorrow (Rome time)", () => {
  // Wed 2026-10-07 10:00 Rome (UTC+2)
  const now = romeWallTimeToUtc(2026, 10, 7, 10, 0);
  const sched = { weekdays: [4], cutoffTime: "18:00:00", leadDays: 1 }; // Thursday deliveries
  const n = nextDeadline(sched, now)!;
  assert.equal(n.deliveryDate, "2026-10-08");
  assert.equal(n.orderDate, "2026-10-07");
  assert.equal(n.deadlineMs, Date.UTC(2026, 9, 7, 16, 0));
  // After the cut-off the next Thursday is the target.
  const late = romeWallTimeToUtc(2026, 10, 7, 19, 0);
  assert.equal(nextDeadline(sched, late)!.deliveryDate, "2026-10-15");
  assert.equal(previousDeadlineMs(sched, late), Date.UTC(2026, 9, 7, 16, 0));
  assert.equal(nextDeadline({ weekdays: [], cutoffTime: null, leadDays: 1 }, now), null);
});

test("reorderStats + suggestedQty", () => {
  const now = Date.parse("2026-10-07T10:00:00Z");
  const s = reorderStats(
    [
      { at: "2026-09-16T20:00:00Z", qty: 4, unitPrice: 3 },
      { at: "2026-09-23T20:00:00Z", qty: 6, unitPrice: 3 },
      { at: "2026-09-30T20:00:00Z", qty: 5, unitPrice: 3.2 },
    ],
    now,
    90,
  )!;
  assert.equal(s.timesOrdered, 3);
  assert.equal(s.typicalQty, 5);
  assert.equal(s.intervalDays, 7);
  assert.equal(s.due, true);
  assert.equal(suggestedQty(s, 10, 7), 3);
  assert.equal(suggestedQty(s, null, null), 5);
});
