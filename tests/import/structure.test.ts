import { test } from "node:test";
import assert from "node:assert/strict";
import { reconstructRows } from "../../lib/import/formats/layout.ts";
import { csvToSourceDoc, numberCell, textToSourceDoc, xlsxToSourceDoc, decodeText } from "../../lib/import/formats/spreadsheet.ts";
import { pdfToSourceDoc } from "../../lib/import/formats/pdf.ts";
import { detectHeader, inferRolesFromContent, headerSignature } from "../../lib/import/understand/table.ts";
import { dedupeProducts } from "../../lib/import/match/dedupe.ts";
import { diffPriceLists } from "../../lib/import/match/diff.ts";
import { similarity, NameIndex } from "../../lib/import/match/similarity.ts";
import { learnAbbreviations, learnFromReview, supplierMemoryKeys } from "../../lib/import/memory.ts";
import { localExtractor } from "../../lib/import/engine.ts";
import { emptyHints, type ExtractedProduct } from "../../lib/import/types.ts";
import { matchSupplierToCatalogs } from "../../lib/import/match/supplier-match.ts";
import { isoToJsWeekdays, orderContactFrom, supplierNotes, toCatalogItem, toProductUnit } from "../../lib/import/catalog-mapping.ts";
import { buildPdf, loadPdfJs } from "./helpers.ts";

test("reconstructRows: columns aligned across lines, right-aligned prices", () => {
  const items = [
    { text: "Codice", x: 40, y: 100, w: 30, h: 9 },
    { text: "Descrizione", x: 95, y: 100, w: 50, h: 9 },
    { text: "Prezzo", x: 490, y: 100, w: 28, h: 9 },
    { text: "PF01", x: 40, y: 120, w: 20, h: 9 },
    { text: "Orata di", x: 95, y: 120, w: 36, h: 9 },
    { text: "allevamento", x: 133, y: 120, w: 52, h: 9 },
    { text: "11,50", x: 496, y: 120.6, w: 22, h: 9 },
    { text: "PF03", x: 40, y: 134, w: 20, h: 9 },
    { text: "Cozze", x: 95, y: 134, w: 25, h: 9 },
    { text: "3,80", x: 501, y: 134, w: 17, h: 9 },
    { text: "PESCE FRESCO E SURGELATO DI QUALITÀ SUPERIORE PER LA RISTORAZIONE", x: 40, y: 80, w: 480, h: 10 },
  ];
  const rows = reconstructRows(items, 595);
  assert.deepEqual(rows[0], ["PESCE FRESCO E SURGELATO DI QUALITÀ SUPERIORE PER LA RISTORAZIONE"]);
  assert.deepEqual(rows[1], ["Codice", "Descrizione", "Prezzo"]);
  assert.deepEqual(rows[2], ["PF01", "Orata di allevamento", "11,50"]);
  assert.deepEqual(rows[3], ["PF03", "Cozze", "3,80"]);
});

test("reconstructRows: missing cells keep their column", () => {
  const items = [
    { text: "A", x: 10, y: 10, w: 10, h: 8 }, { text: "Uno", x: 100, y: 10, w: 20, h: 8 }, { text: "1,00", x: 300, y: 10, w: 20, h: 8 },
    { text: "Due", x: 100, y: 25, w: 20, h: 8 }, { text: "2,00", x: 300, y: 25, w: 20, h: 8 },
    { text: "C", x: 10, y: 40, w: 10, h: 8 }, { text: "Tre", x: 100, y: 40, w: 20, h: 8 }, { text: "3,00", x: 300, y: 40, w: 20, h: 8 },
  ];
  assert.deepEqual(reconstructRows(items, 400), [["A", "Uno", "1,00"], ["", "Due", "2,00"], ["C", "Tre", "3,00"]]);
});

test("spreadsheet rendering: CSV delimiter guess, Windows-1252, numeric cells", async () => {
  const doc = await csvToSourceDoc("Prodotto;Prezzo\nCaffè;12,50\n", "x.csv");
  assert.deepEqual(doc.sheets[0]!.rows, [["Prodotto", "Prezzo"], ["Caffè", "12,50"]]);
  const latin1 = new Uint8Array([0x43, 0x61, 0x66, 0x66, 0xe8]); // "Caffè" in Windows-1252
  assert.equal(decodeText(latin1), "Caffè");
  assert.equal(numberCell(3.2), "3,2");
  assert.equal(numberCell(1.234), "1,234");
  assert.equal(numberCell(12), "12");

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Listino");
  ws.addRow(["Descrizione", "Prezzo"]);
  ws.addRow(["Olio", 9.5]);
  ws.getCell("A3").value = "Sale";
  ws.getCell("C3").value = { formula: "1+1", result: 2 } as never;
  const hidden = wb.addWorksheet("Nascosto", { state: "hidden" });
  hidden.addRow(["x"]);
  const xdoc = await xlsxToSourceDoc((await wb.xlsx.writeBuffer()) as ArrayBuffer, "l.xlsx");
  assert.equal(xdoc.sheets.length, 1);
  assert.deepEqual(xdoc.sheets[0]!.rows, [["Descrizione", "Prezzo"], ["Olio", "9,5"], ["Sale", "", "2"]]);
});

test("pasted tab-separated text becomes a table", () => {
  const doc = textToSourceDoc("A\tB\n1\t2\n3\t4\n");
  assert.equal(doc.sheets[0]!.layout, "table");
  assert.equal(textToSourceDoc("riga uno\nriga due").sheets[0]!.layout, "text");
});

test("PDF text layer → rows (pdfjs, real PDF bytes)", async () => {
  const bytes = buildPdf([
    { x: 40, y: 800, size: 10, text: "Descrizione" },
    { x: 400, y: 800, size: 10, text: "Prezzo" },
    { x: 40, y: 780, size: 10, text: "Caffè in grani" },
    { x: 400, y: 780, size: 10, text: "€ 17,50" },
  ]);
  const doc = await pdfToSourceDoc(bytes, { pdfjs: await loadPdfJs() });
  assert.equal(doc.kind, "pdf");
  assert.deepEqual(doc.sheets[0]!.rows, [["Descrizione", "Prezzo"], ["Caffè in grani", "€ 17,50"]]);
});

test("table: header detection and content roles", () => {
  const rows = [
    ["Fornitore Rossi"],
    ["Cod.", "Descrizione", "UM", "Prezzo €"],
    ["A1", "Pomodori", "KG", "2,50"],
  ];
  const h = detectHeader(rows);
  assert.equal(h?.index, 1);
  assert.deepEqual(h?.roles, { 0: "code", 1: "name", 2: "unit", 3: "price" });
  const { roles } = inferRolesFromContent([
    ["1001", "Petto di pollo a fette", "KG", "8.90"],
    ["1002", "Cosce di pollo", "KG", "4.20"],
    ["1003", "Hamburger di scottona", "PZ", "2.10"],
  ]);
  assert.equal(roles[1], "name");
  assert.equal(roles[2], "unit");
  assert.equal(roles[3], "price");
  assert.equal(roles[0], "code");
  assert.equal(headerSignature(["Cod.", "Descrizione"]), "cod|descrizione");
});

function product(over: Partial<ExtractedProduct>): ExtractedProduct {
  const fc = { score: 0.9, reason: "" };
  return {
    id: "x", original: "", sourceKey: "k", name: "Pomodori", format: null, code: null, brand: null, category: "verdura",
    section: null, price: 3, priceUnit: "kg", pack: {}, unitPrice: null, vatRate: null, minQty: null, availability: null,
    available: true, origin: null, confidence: { overall: 0.9, name: fc, price: fc, unit: fc, category: fc }, issues: [],
    fromMemory: false, mergedCount: 0, ...over,
  };
}

test("dedupe merges duplicates and flags different prices", () => {
  const { products, merged } = dedupeProducts([
    product({ id: "a", name: "Pomodori datterini", price: 3.2 }),
    product({ id: "b", name: "pomodori  datterini", price: 3.5, confidence: { ...product({}).confidence, overall: 0.5 } }),
    product({ id: "c", name: "Pomodori datterini", format: "cassa 5 kg", priceUnit: "cassa", price: 14 }),
  ]);
  assert.equal(merged, 1);
  assert.equal(products.length, 2);
  assert.equal(products[0]!.id, "a");
  assert.equal(products[0]!.mergedCount, 1);
  assert.match(products[0]!.issues[0]!, /prezzo diverso/);
});

test("diffPriceLists: increased, decreased, unchanged, new, removed, fuzzy", () => {
  const d = diffPriceLists(
    [
      { id: "1", name: "Pomodori datterini", unit: "kg", price: 3 },
      { id: "2", name: "Zucchine", unit: "kg", price: 2 },
      { id: "3", name: "Basilico", unit: "pz", price: 0.8 },
      { id: "4", name: "Melanzane tonde", unit: "kg", price: 1.5 },
      { id: "5", name: "Patate gialle", unit: "kg", price: 1 },
    ],
    [
      { key: "a", name: "Pomodori datterini", unit: "kg", price: 3.2 },
      { key: "b", name: "zucchine", unit: "kg", price: 1.8 },
      { key: "c", name: "Basilico", unit: "pz", price: 0.8 },
      { key: "d", name: "Melanzana tonda", unit: "kg", price: 1.6 },
      { key: "e", name: "Carciofi", unit: "pz", price: 0.9 },
    ],
  );
  assert.deepEqual(d.counts, { new: 1, increased: 2, decreased: 1, unchanged: 1, removed: 1 });
  assert.equal(d.matches.d, "4");
  const inc = d.entries.find((e) => e.incoming?.key === "a")!;
  assert.equal(inc.delta, 0.2);
  assert.equal(inc.pct, 0.067);
});

test("similarity and NameIndex", () => {
  assert.ok(similarity("Mozzarella fior di latte", "mozzarella fiordilatte") > 0.6);
  assert.ok(similarity("Pomodori", "Detergente") < 0.3);
  const idx = new NameIndex([{ n: "Parmigiano Reggiano 24 mesi" }, { n: "Grana Padano" }], (x) => x.n);
  assert.equal(idx.best("parmigiano reggiano")?.item.n, "Parmigiano Reggiano 24 mesi");
});

test("memory: learn corrections and re-apply them on the next import", async () => {
  assert.deepEqual(learnAbbreviations("Pomd. ross.", "Pomodori rossi"), { pomd: "pomodori", ross: "rossi" });
  assert.deepEqual(learnAbbreviations("MZB 250g", "Mozzarella di bufala"), {});
  assert.deepEqual(supplierMemoryKeys({ vatNumber: "01234567897", name: "Rossi S.r.l." }, "cat-1"), [
    "catalog:cat-1", "piva:01234567897", "name:rossi",
  ]);

  const doc = textToSourceDoc("Pomd. ross. 3,20 €/kg\nBasilico 0,80 cad\nSpese trasporto 5,00 €\nMis. bosco 4,50 €");
  const first = await localExtractor.extract(doc, { persona: "restaurant" });
  const pomd = first.products.find((p) => /pomd/i.test(p.name))!;
  const basil = first.products.find((p) => /basilico/i.test(p.name))!;
  const mis = first.products.find((p) => /mis/i.test(p.name))!;
  assert.ok(pomd.issues.some((i) => /Abbreviazioni/.test(i)));

  const { hints, learnedCount } = learnFromReview(emptyHints(), first.products, [
    { id: pomd.id, name: "Pomodori rossi", priceUnit: "kg", category: "verdura" },
    { id: basil.id, name: basil.name, priceUnit: "mazzo", category: "verdura" },
    { id: mis.id, name: mis.name, priceUnit: mis.priceUnit, category: mis.category, removed: true },
  ]);
  assert.equal(learnedCount, 3);
  assert.equal(hints.abbreviations.pomd, "pomodori");

  const second = await localExtractor.extract(doc, { persona: "restaurant", loadHints: () => hints });
  const p2 = second.products.find((p) => p.name === "Pomodori rossi")!;
  assert.ok(p2.fromMemory);
  assert.ok(p2.confidence.overall >= 0.9);
  assert.equal(second.products.find((p) => /basilico/i.test(p.name))!.priceUnit, "mazzo");
  assert.equal(second.products.some((p) => /mis/i.test(p.name)), false);
  assert.ok(second.warnings.some((w) => /ignorate/.test(w)));
});

test("supplier ↔ existing catalogs and table mapping", () => {
  const cands = matchSupplierToCatalogs({ name: "Rossi Ortofrutta S.r.l.", vatNumber: null }, [
    { id: "a", supplier_name: "ROSSI ORTOFRUTTA", notes: null },
    { id: "b", supplier_name: "Caseificio Valle", notes: "P.IVA 01234567897" },
    { id: "c", supplier_name: "Bianchi carni", notes: null },
  ]);
  assert.equal(cands[0]?.catalogId, "a");
  assert.equal(cands.length, 1);
  const byVat = matchSupplierToCatalogs({ name: "Altro nome", vatNumber: "01234567897" }, [
    { id: "b", supplier_name: "Caseificio Valle", notes: "P.IVA 01234567897 · Tel 0828 123456" },
  ]);
  assert.deepEqual(byVat.map((c) => [c.catalogId, c.reason]), [["b", "Stessa partita IVA"]]);

  assert.deepEqual(toProductUnit("hg", 2.5), { unit: "kg", price: 25 });
  assert.deepEqual(toProductUnit("cassa", 18), { unit: "cartone", price: 18 });
  assert.deepEqual(toProductUnit("vaschetta", 2.5), { unit: "confezione", price: 2.5 });
  const item = toCatalogItem({
    name: "Olio extravergine di oliva", format: "6 × 1 l", price: 39, priceUnit: "cartone",
    unitPrice: { value: 6.5, base: "l" }, availability: null, vatRate: 4,
  });
  assert.deepEqual(item, { product_name: "Olio extravergine di oliva 6 × 1 l", unit: "cartone", price: 39, notes: "6,50 €/l · IVA 4%" });
  const notes = supplierNotes({
    vatNumber: "01234567897", phones: ["0828 123456"], emails: ["a@b.it"], pec: null, address: "Via Roma 1",
    zip: "84047", city: "Capaccio", province: "SA", deliveryDays: [1, 3, 5], orderCutoff: "18:00", freeDeliveryOver: null, notes: [],
  });
  assert.equal(notes, "P.IVA 01234567897 · Tel 0828 123456 · a@b.it · Via Roma 1 84047 Capaccio (SA) · Consegna: Lun, Mer, Ven · Ordini entro 18:00");
});

test("re-import of the same supplier (found by P.IVA) applies what was learned", async () => {
  const doc1 = textToSourceDoc("Ortofrutta Sud srl - P.IVA 01234567897\nPomd. ross. 3,20 €/kg\nBasil. 0,80\nZucchine 1,60 kg");
  const first = await localExtractor.extract(doc1, { persona: "restaurant" });
  assert.equal(first.supplier.vatNumber, "01234567897");
  const pomd = first.products.find((p) => /pomd/i.test(p.name))!;
  const basil = first.products.find((p) => /basil/i.test(p.name))!;
  const { hints } = learnFromReview(emptyHints(), first.products, [
    { id: pomd.id, name: "Pomodori rossi", priceUnit: "kg", category: "verdura" },
    { id: basil.id, name: "Basilico", priceUnit: "mazzo", category: "verdura" },
  ]);
  const store = new Map(supplierMemoryKeys({ vatNumber: "01234567897", name: "Ortofrutta Sud srl" }, "cat-1").map((k) => [k, hints]));
  const asked: string[][] = [];
  // next week's list: other prices, same abbreviations, supplier name written differently
  const doc2 = textToSourceDoc("ORTOFRUTTA SUD - partita iva 01234567897\nPomd. ross. 3,50 €/kg\nBasil. 0,90");
  const second = await localExtractor.extract(doc2, {
    persona: "restaurant",
    loadHints: (s) => {
      const keys = supplierMemoryKeys(s);
      asked.push(keys);
      return keys.map((k) => store.get(k)).find(Boolean) ?? null;
    },
  });
  assert.ok(asked[0]!.includes("piva:01234567897"));
  const p = second.products.find((x) => x.name === "Pomodori rossi");
  assert.ok(p?.fromMemory);
  assert.equal(p?.price, 3.5);
  const b = second.products.find((x) => x.name === "Basilico");
  assert.equal(b?.priceUnit, "mazzo");
});

test("schedule and contact mapping for the restaurant tables", () => {
  assert.deepEqual(isoToJsWeekdays([1, 3, 5]), [1, 3, 5]);
  assert.deepEqual(isoToJsWeekdays([6, 7, 7, 2]), [0, 2, 6]);
  assert.deepEqual(orderContactFrom(["0828 123456", "347 987 6543"], ["ordini@x.it"]), {
    preferredChannel: "whatsapp", phone: "347 987 6543", email: "ordini@x.it",
  });
  assert.deepEqual(orderContactFrom(["0828 123456"], ["x@pec.it", "ordini@x.it"]), {
    preferredChannel: "email", phone: "0828 123456", email: "ordini@x.it",
  });
  assert.equal(orderContactFrom(["0828 123456"], [])?.preferredChannel, "phone");
  assert.equal(orderContactFrom([" "], ["non-una-mail"]), null);
});

test("engine never drops rows silently over the limit", async () => {
  const lines = Array.from({ length: 20_005 }, (_, i) => `Prodotto ${i} 1,00 €`).join("\n");
  const res = await localExtractor.extract(textToSourceDoc(lines), { persona: "supplier" });
  assert.ok(res.warnings.some((w) => /20\.000 righe/.test(w)));
  assert.ok(res.warnings.some((w) => /al massimo 5000/.test(w)));
  assert.equal(res.products.length, 5000);
});
