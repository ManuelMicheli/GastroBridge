import { test } from "node:test";
import assert from "node:assert/strict";
import { findMoney, findVat, parseNumber } from "../../lib/import/parse/numbers.ts";
import { computeUnitPrice, parsePack, unitFromWord } from "../../lib/import/parse/units.ts";
import {
  findAddress,
  findCutoff,
  findDeliveryDays,
  findEmails,
  findLeadTime,
  findMinOrder,
  findPhones,
  findVatNumber,
  isValidPartitaIva,
  supplierNameKey,
} from "../../lib/import/parse/supplier-info.ts";
import { cleanLine, fixOcrDigits, sentenceCase, stripChatPrefix } from "../../lib/import/text.ts";
import { expandAbbreviations } from "../../lib/import/lexicon/abbreviations.ts";
import { categoryFromHeading, classifyCategory } from "../../lib/import/lexicon/categories.ts";
import { parseProductText } from "../../lib/import/understand/product-line.ts";
import { classifyLine } from "../../lib/import/understand/classify.ts";
import { parseOrderLine, parseOrderLines } from "../../lib/import/understand/order-lines.ts";
import { textToSourceDoc } from "../../lib/import/formats/spreadsheet.ts";

test("parseNumber: Italian and English formats", () => {
  assert.equal(parseNumber("1.234,56"), 1234.56);
  assert.equal(parseNumber("1.234,56 €"), 1234.56);
  assert.equal(parseNumber("€ 3,20"), 3.2);
  assert.equal(parseNumber("3.20"), 3.2);
  assert.equal(parseNumber("3,2"), 3.2);
  assert.equal(parseNumber("1,234.56"), 1234.56);
  assert.equal(parseNumber("1.234"), 1234);
  assert.equal(parseNumber("0.750"), 0.75);
  assert.equal(parseNumber("12"), 12);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseNumber(""), null);
});

test("findMoney: euro markers, spoken prices, € between numbers", () => {
  const a = findMoney("Pomodori 3,20€/kg");
  assert.equal(a.length, 1);
  assert.equal(a[0]!.value, 3.2);
  assert.ok(a[0]!.euro);
  const b = findMoney("Patate 3 e 20 al kg");
  assert.ok(b.some((c) => c.spoken && c.value === 3.2));
  const c = findMoney("Acqua 50cl x 24 € 5,80");
  const euro = c.filter((x) => x.euro);
  assert.equal(euro.length, 1);
  assert.equal(euro[0]!.value, 5.8);
});

test("findVat", () => {
  assert.equal(findVat("Farina 00 + iva 4%")?.rate, 4);
  assert.equal(findVat("IVA 22% inclusa")?.included, true);
  assert.equal(findVat("prezzi IVA esclusa")?.included, false);
  assert.equal(findVat("Tonno all'olio d'oliva 1,7 kg"), null);
  assert.equal(findVat("10% iva")?.rate, 10);
});

test("parsePack: multi packs, containers, sizes, bases", () => {
  const a = parsePack("Olio EVO 6x1L");
  assert.equal(a.pack.pieces, 6);
  assert.deepEqual(a.pack.total, { value: 6, base: "l" });
  const b = parsePack("Mozzarella 125g x 8");
  assert.equal(b.pack.pieces, 8);
  assert.deepEqual(b.pack.total, { value: 1, base: "kg" });
  const c = parsePack("Arance cassa da 15 kg");
  assert.equal(c.pack.container, "cassa");
  assert.deepEqual(c.pack.total, { value: 15, base: "kg" });
  const d = parsePack("Acqua CT 24");
  assert.equal(d.pack.container, "cartone");
  assert.equal(d.pack.pieces, 24);
  const e = parsePack("Zucchine al kg");
  assert.equal(e.basis, "kg");
  const f = parsePack("Birra 50cl cartone da 12 bottiglie");
  assert.equal(f.pack.container, "cartone");
  assert.equal(f.pack.pieces, 12);
  const g = parsePack("Coca Cola x24");
  assert.equal(g.pack.pieces, 24);
  // "cassa 14" alone is a price, not 14 pieces
  assert.equal(parsePack("Pomodori cassa 14").pack.pieces, undefined);
});

test("unitFromWord and computeUnitPrice", () => {
  assert.equal(unitFromWord("KG"), "kg");
  assert.equal(unitFromWord("Lt."), "l");
  assert.equal(unitFromWord("CRT"), "cartone");
  assert.equal(unitFromWord("cf"), "confezione");
  assert.equal(unitFromWord("btg"), "bottiglia");
  assert.equal(unitFromWord("latte"), null); // milk, not a can
  assert.deepEqual(computeUnitPrice(39, "confezione", { pieces: 6, pieceSize: { value: 1, base: "l" }, total: { value: 6, base: "l" } }), { value: 6.5, base: "l" });
  assert.deepEqual(computeUnitPrice(2.5, "kg", {}), { value: 2.5, base: "kg" });
  assert.deepEqual(computeUnitPrice(1.2, "pz", { pieceSize: { value: 0.125, base: "kg" } }), { value: 9.6, base: "kg" });
  assert.deepEqual(computeUnitPrice(0.5, "hg", {}), { value: 5, base: "kg" });
});

test("P.IVA checksum and detection", () => {
  assert.ok(isValidPartitaIva("01234567897"));
  assert.ok(!isValidPartitaIva("01234567890"));
  assert.ok(isValidPartitaIva("IT02345678904"));
  const v = findVatNumber("Caseificio srl - P.IVA 01234567897 - REA 1234");
  assert.equal(v?.value, "01234567897");
  assert.ok(v?.valid);
  assert.equal(findVatNumber("partita iva: 01234567890")?.valid, false);
});

test("contacts and address", () => {
  assert.deepEqual(findEmails("scrivi a Ordini@Esempio.it o pec@pec.esempio.it."), ["ordini@esempio.it", "pec@pec.esempio.it"]);
  assert.deepEqual(findPhones("Tel. 0828 123456 - Cell. 347 9876543"), ["0828 123456", "347 987 6543"]);
  assert.deepEqual(findPhones("valido dal 01/10/2026"), []);
  assert.deepEqual(findPhones("P.IVA 01234567897", ["01234567897"]), []);
  const a = findAddress("Via dei Mulini 14, 84047 Capaccio Paestum (SA)");
  assert.equal(a.zip, "84047");
  assert.equal(a.province, "SA");
  assert.match(a.address ?? "", /^Via dei Mulini 14/);
});

test("delivery days, minimum order, cut-off, lead time", () => {
  assert.deepEqual(findDeliveryDays("consegna lun-gio")?.days, [1, 2, 3, 4]);
  assert.deepEqual(findDeliveryDays("Consegniamo lun-mer-ven")?.days, [1, 3, 5]);
  assert.deepEqual(findDeliveryDays("consegna dal lunedì al venerdì")?.days, [1, 2, 3, 4, 5]);
  assert.deepEqual(findDeliveryDays("Consegna tutti i giorni tranne la domenica")?.days, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(findDeliveryDays("Consegna mar, gio e sab")?.days, [2, 4, 6]);
  assert.equal(findDeliveryDays("Pomodori di stagione"), null);
  assert.equal(findMinOrder("minimo 100€"), 100);
  assert.equal(findMinOrder("Ordine minimo € 150,00"), 150);
  assert.equal(findMinOrder("min 5 kg"), null);
  assert.equal(findCutoff("ordini entro le 18"), "18:00");
  assert.equal(findCutoff("ordini entro le ore 16:30"), "16:30");
  assert.equal(findLeadTime("consegna in 24h"), 1);
  assert.equal(findLeadTime("consegna in 48 ore"), 2);
  assert.equal(supplierNameKey("Rossi S.r.l."), supplierNameKey("ROSSI SRL"));
});

test("text cleaning: chats, bullets, OCR digits, case", () => {
  assert.deepEqual(stripChatPrefix("[03/10/26, 07:42:10] Mario: ciao"), { text: "ciao", sender: "Mario" });
  assert.deepEqual(stripChatPrefix("12/10/26, 06:58 - Pescheria: Orata 12€"), { text: "Orata 12€", sender: "Pescheria" });
  assert.equal(cleanLine("  • Pomodori 🍅 3,20 €  "), "Pomodori 3,20 €");
  assert.equal(cleanLine("1) Zucchine 1,80"), "Zucchine 1,80");
  assert.equal(fixOcrDigits("Pagnotta l,90"), "Pagnotta 1,90");
  assert.equal(fixOcrDigits("Cornetti O,70 Olio"), "Cornetti 0,70 Olio");
  assert.equal(sentenceCase("POMODORI PELATI DOP"), "Pomodori pelati DOP");
});

test("abbreviation expansion", () => {
  assert.equal(expandAbbreviations("Pomod. datt.").text, "pomodori datterini");
  assert.equal(expandAbbreviations("Mozz. FDL").text, "mozzarella fior di latte");
  assert.equal(expandAbbreviations("Olio e.v.o.").text, "Olio extravergine di oliva");
  assert.equal(expandAbbreviations("mela golden").text, "mela golden"); // no dot → no expansion
  assert.deepEqual(expandAbbreviations("Pomd. rossi").unknown, ["Pomd."]);
  assert.equal(expandAbbreviations("Pomd. rossi", { pomd: "pomodori" }).text, "pomodori rossi");
  // in ALL CAPS text short words are not acronyms
  assert.equal(expandAbbreviations("acqua PET", {}, { allCaps: true }).text, "acqua PET");
});

test("category classifier", () => {
  assert.equal(classifyCategory("Pomodori datterini").category, "verdura");
  assert.equal(classifyCategory("Gamberi rossi surgelati").category, "surgelati");
  assert.equal(classifyCategory("Tonno all'olio d'oliva").category, "secco");
  assert.equal(classifyCategory("Mozzarella di bufala").category, "latticini");
  assert.equal(classifyCategory("Detergente lavastoviglie").category, "pulizia");
  assert.equal(classifyCategory("Prodotto misterioso").category, "altro");
  assert.equal(categoryFromHeading("FRUTTA"), "frutta");
  assert.equal(categoryFromHeading("Salumi e affettati"), "carne");
});

test("product line parsing end to end", () => {
  const cases: Array<[string, { name: string; price: number; basis?: string | null; format?: string | null }]> = [
    ["Pomodori datterini 3,20€/kg", { name: "Pomodori datterini", price: 3.2, basis: "kg" }],
    ["POMOD. DATT. CRT 5KG  € 14,50", { name: "POMOD. DATT.", price: 14.5, format: "cartone 5 kg" }],
    ["Olio EVO 6x1L 39,00", { name: "Olio EVO", price: 39, format: "6 × 1 l" }],
    ["Farina 00 sacco 25 kg 18.50 + iva 4%", { name: "Farina 00", price: 18.5, format: "sacco 25 kg" }],
    ["A1023  Prosciutto crudo di Parma DOP 24 mesi  kg  18,90", { name: "Prosciutto crudo di Parma DOP 24 mesi", price: 18.9, basis: "kg" }],
    ["Acqua naturale 50cl x 24 € 5,80 a cassa", { name: "Acqua naturale", price: 5.8, basis: "cassa" }],
    ["Patate 3 e 20 al kg", { name: "Patate", price: 3.2, basis: "kg" }],
    ["Spaghetti Barilla n.5 5kg 9,90", { name: "Spaghetti Barilla n.5", price: 9.9 }],
  ];
  for (const [line, exp] of cases) {
    const p = parseProductText(line);
    assert.equal(p.nameRaw, exp.name, line);
    assert.equal(p.price, exp.price, line);
    if (exp.basis !== undefined) assert.equal(p.priceBasis, exp.basis, line);
    if (exp.format !== undefined) assert.equal(p.format, exp.format, line);
  }
  const code = parseProductText("A1023  Prosciutto crudo kg 18,90");
  assert.equal(code.code, "A1023");
  const vat = parseProductText("Farina 00 sacco 25 kg 18.50 + iva 4%");
  assert.equal(vat.vatRate, 4);
  const av = parseProductText("Limoni €2,50 kg (disponibili fino a dicembre)");
  assert.equal(av.availability, "disponibili fino a dicembre");
  assert.equal(parseProductText("Bresaola 27,50 esaurita").available, false);
});

test("order lines for the typical-order import", () => {
  assert.deepEqual(parseOrderLine("10 kg farina 00"), { name: "farina 00", qty: 10, unit: "kg", raw: "10 kg farina 00" });
  assert.equal(parseOrderLine("Olio evo x 6")?.qty, 6);
  assert.equal(parseOrderLine("pomodori pelati: 3 casse")?.unit, "cassa");
  assert.equal(parseOrderLine("Farina 00"), null);
  assert.equal(parseOrderLine("farina 00 10 kg")?.name, "farina 00");
  assert.equal(parseOrderLine("Buongiorno, per domani:"), null);
  const { lines, skipped } = parseOrderLines(textToSourceDoc("Ciao Mario, per domani:\n- 2 crt acqua naturale\n- mozzarella 5 kg\n- basilico 3 mazzi"));
  assert.equal(lines.length, 3);
  assert.equal(skipped, 1);
  const table = parseOrderLines(textToSourceDoc("Prodotto\tQuantità\nFarina 00\t10\nOlio\t5\nSale\t2\n"));
  assert.deepEqual(table.lines.map((l) => [l.name, l.qty]), [["Farina 00", 10], ["Olio", 5], ["Sale", 2]]);
});

test("line classifier", () => {
  assert.equal(classifyLine("Pomodori datterini 3,20 €/kg").cls, "product");
  assert.equal(classifyLine("Ordine minimo 80 €").cls, "supplier");
  assert.equal(classifyLine("P.IVA 01234567897 - Tel 0828 123456").cls, "supplier");
  assert.equal(classifyLine("FRUTTA").cls, "section");
  assert.equal(classifyLine("Codice  Descrizione  U.M.  Prezzo").cls, "header");
  assert.equal(classifyLine("Buongiorno, ecco il listino").cls, "noise");
  assert.equal(classifyLine("Perfetto grazie Mario!").cls, "noise");
});
