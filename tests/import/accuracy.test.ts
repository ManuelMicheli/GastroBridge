// Extraction accuracy on the synthetic Italian corpus (tests/fixtures/import).
//
//  - expected.json:          tuning corpus (heuristics were iterated on it)
//  - expected-heldout.json:  held-out corpus, written afterwards, measures generalisation
//  - expected-blind.json:    corpus written in the hardening pass before looking
//                            at the output (adds pack scoring), then iterated on
//  - expected-fresh.json:    written after the hardening pass, never tuned on
//
// Prints a per-fixture report (set IMPORT_VERBOSE=1 for every mismatch) and
// enforces minimum accuracies.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localExtractor } from "../../lib/import/engine.ts";
import { fixturePath, loadFixture, pct, scoreResult, type Gold, type Score } from "./helpers.ts";

type Floors = { recall: number; precision: number; price: number; unit: number; category: number; supplier: number; pack?: number };

const verbose = process.env.IMPORT_VERBOSE === "1";

function emptyScore(): Score {
  return {
    expected: 0, extracted: 0, found: 0, nameOk: 0, priceOk: 0, unitOk: 0, categoryOk: 0, extraOk: 0, extraTotal: 0,
    supplierOk: 0, supplierTotal: 0, packOk: 0, packTotal: 0, failures: [],
  };
}

const f = (a: number, b: number) => `${(pct(a, b) * 100).toFixed(1)}%`;

function runCorpus(goldFile: string, label: string, docFloors: Floors, corpusFloors: Floors) {
  const gold = JSON.parse(readFileSync(fixturePath(goldFile), "utf8")) as Record<string, Gold | string>;
  const fixtures = Object.entries(gold).filter((e): e is [string, Gold] => typeof e[1] === "object");
  const totals = emptyScore();
  const rows: string[] = [];

  for (const [name, g] of fixtures) {
    test(`${label}: ${name}`, async () => {
      const doc = await loadFixture(name, g.kind);
      const res = await localExtractor.extract(doc, { persona: "restaurant" });
      const s = scoreResult(res, g);
      for (const k of Object.keys(totals) as Array<keyof Score>) {
        if (k !== "failures") (totals[k] as number) += s[k] as number;
      }
      rows.push(
        `${name.padEnd(30)} recall ${f(s.found, s.expected).padStart(6)}  precision ${f(s.found, s.extracted).padStart(6)}  ` +
          `name ${f(s.nameOk, s.found).padStart(6)}  price ${f(s.priceOk, s.found).padStart(6)}  unit ${f(s.unitOk, s.found).padStart(6)}  ` +
          `cat ${f(s.categoryOk, s.found).padStart(6)}  pack ${s.packOk}/${s.packTotal}  supplier ${s.supplierOk}/${s.supplierTotal}`,
      );
      if (verbose || s.failures.length) for (const fl of s.failures) rows.push(`    · ${fl}`);
      const why = s.failures.join("\n");
      assert.ok(pct(s.found, s.expected) >= docFloors.recall, `recall ${s.found}/${s.expected}\n${why}`);
      assert.ok(pct(s.found, s.extracted) >= docFloors.precision, `precision ${s.found}/${s.extracted}\n${why}`);
      assert.ok(pct(s.priceOk, s.found) >= docFloors.price, `price ${s.priceOk}/${s.found}\n${why}`);
      assert.ok(pct(s.unitOk, s.found) >= docFloors.unit, `unit ${s.unitOk}/${s.found}\n${why}`);
      assert.ok(pct(s.categoryOk, s.found) >= docFloors.category, `category ${s.categoryOk}/${s.found}\n${why}`);
      assert.ok(pct(s.supplierOk, s.supplierTotal) >= docFloors.supplier, `supplier ${s.supplierOk}/${s.supplierTotal}\n${why}`);
      if (docFloors.pack !== undefined) assert.ok(pct(s.packOk, s.packTotal) >= docFloors.pack, `pack ${s.packOk}/${s.packTotal}\n${why}`);
    });
  }

  test(`${label}: summary`, () => {
    const t = totals;
    rows.push(
      `${label.toUpperCase()}  documents ${fixtures.length}  products ${t.expected}  recall ${f(t.found, t.expected)}  precision ${f(t.found, t.extracted)}  ` +
        `name ${f(t.nameOk, t.found)}  price ${f(t.priceOk, t.found)}  unit ${f(t.unitOk, t.found)}  category ${f(t.categoryOk, t.found)}  ` +
        `pack ${t.packOk}/${t.packTotal} (${f(t.packOk, t.packTotal)})  vat/availability ${t.extraOk}/${t.extraTotal}  supplier fields ${t.supplierOk}/${t.supplierTotal} (${f(t.supplierOk, t.supplierTotal)})`,
    );
    console.log(`\n${rows.join("\n")}\n`);
    assert.ok(pct(t.found, t.expected) >= corpusFloors.recall);
    assert.ok(pct(t.found, t.extracted) >= corpusFloors.precision);
    assert.ok(pct(t.priceOk, t.found) >= corpusFloors.price);
    assert.ok(pct(t.unitOk, t.found) >= corpusFloors.unit);
    assert.ok(pct(t.categoryOk, t.found) >= corpusFloors.category);
    assert.ok(pct(t.supplierOk, t.supplierTotal) >= corpusFloors.supplier);
    if (corpusFloors.pack !== undefined) assert.ok(pct(t.packOk, t.packTotal) >= corpusFloors.pack);
  });
}

runCorpus(
  "expected.json",
  "tuning corpus",
  { recall: 0.9, precision: 0.85, price: 0.9, unit: 0.75, category: 0.75, supplier: 0.7 },
  { recall: 0.97, precision: 0.95, price: 0.97, unit: 0.9, category: 0.9, supplier: 0.9 },
);

runCorpus(
  "expected-heldout.json",
  "held-out corpus",
  { recall: 0.8, precision: 0.75, price: 0.8, unit: 0.6, category: 0.7, supplier: 0.6 },
  { recall: 0.9, precision: 0.85, price: 0.9, unit: 0.75, category: 0.85, supplier: 0.75 },
);

runCorpus(
  "expected-blind.json",
  "blind corpus",
  { recall: 0.9, precision: 0.85, price: 0.9, unit: 0.75, category: 0.75, supplier: 0.7, pack: 0.75 },
  { recall: 0.97, precision: 0.95, price: 0.97, unit: 0.93, category: 0.93, supplier: 0.9, pack: 0.9 },
);

runCorpus(
  "expected-fresh.json",
  "fresh corpus",
  { recall: 0.8, precision: 0.75, price: 0.8, unit: 0.6, category: 0.6, supplier: 0.6, pack: 0.6 },
  { recall: 0.9, precision: 0.85, price: 0.9, unit: 0.8, category: 0.8, supplier: 0.75, pack: 0.75 },
);
