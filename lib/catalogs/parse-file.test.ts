import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLayout, suggestMapping } from "./parse-file.ts";

function buildObjs(headers: string[], rows: string[][]) {
  return rows.map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = r[i] ?? ""; });
    return o;
  });
}

test("standard Italian header, columns in order", () => {
  const headers = ["Prodotto", "Unità", "Prezzo"];
  const rows = [["Pomodori pelati", "kg", "1,20"], ["Olio EVO", "lt", "8,50"]];
  const m = suggestMapping(headers, buildObjs(headers, rows));
  assert.equal(m.name, "Prodotto");
  assert.equal(m.unit, "Unità");
  assert.equal(m.price, "Prezzo");
  assert.ok(m.confident);
});

test("reordered + extra code column — price not confused with SKU", () => {
  const headers = ["Codice", "Prezzo", "Descrizione", "UM"];
  const rows = [
    ["1001", "1,20", "Pomodori pelati 400g", "kg"],
    ["1002", "8,50", "Olio extravergine", "lt"],
    ["1003", "0,90", "Pane casereccio", "pz"],
  ];
  const m = suggestMapping(headers, buildObjs(headers, rows));
  assert.equal(m.price, "Prezzo");
  assert.equal(m.name, "Descrizione");
  assert.notEqual(m.name, "Codice");
});

test("German headers", () => {
  const headers = ["Artikel", "Einheit", "Preis"];
  const rows = [["Tomaten", "kg", "1.20"], ["Olivenöl", "lt", "8.50"]];
  const m = suggestMapping(headers, buildObjs(headers, rows));
  assert.equal(m.name, "Artikel");
  assert.equal(m.price, "Preis");
});

test("detectLayout skips title/preamble rows", () => {
  const aoa = [
    ["LISTINO PREZZI 2026"],
    [""],
    ["Fornitore: Rossi SRL"],
    ["Prodotto", "Unità", "Prezzo"],
    ["Pomodori", "kg", "1,20"],
    ["Olio", "lt", "8,50"],
  ];
  const layout = detectLayout(aoa);
  assert.equal(layout.hasHeader, true);
  assert.equal(layout.headerRowIndex, 3);
  assert.equal(layout.mapping.name, "Prodotto");
});

test("detectLayout handles a file with no header row", () => {
  const aoa = [
    ["Pomodori pelati 400g", "kg", "1,20"],
    ["Olio extravergine", "lt", "8,50"],
    ["Pane casereccio", "pz", "0,90"],
    ["Farina 00", "kg", "0,70"],
  ];
  const layout = detectLayout(aoa);
  assert.equal(layout.hasHeader, false);
  assert.ok(layout.mapping.name);
  assert.ok(layout.mapping.price);
});

test("integer-only numeric column is not picked as price when a decimal one exists", () => {
  const headers = ["Nome", "Qta", "Costo"];
  const rows = [
    ["Pomodori", "10", "1,20"],
    ["Olio", "5", "8,50"],
    ["Pane", "20", "0,90"],
  ];
  const m = suggestMapping(headers, buildObjs(headers, rows));
  assert.equal(m.price, "Costo");
});
