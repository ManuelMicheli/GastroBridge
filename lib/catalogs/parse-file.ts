"use client";

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { normalizePrice } from "./normalize";

export type ParsedRow = Record<string, string>;
export type ParsedSheet = {
  headers: string[];      // from row 1 if hasHeader; else ["Col 1", "Col 2", ...]
  rows: ParsedRow[];      // keyed by header
  hasHeader: boolean;
};

export async function parseCsv(file: File, hasHeader = true): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const rawRows = res.data as string[][];
        if (rawRows.length === 0) { reject(new Error("File vuoto")); return; }
        const headers = hasHeader
          ? rawRows[0]!.map((h, i) => (h?.trim() ? h.trim() : `Col ${i + 1}`))
          : rawRows[0]!.map((_, i) => `Col ${i + 1}`);
        const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
        const rows: ParsedRow[] = dataRows.map((r) => {
          const obj: ParsedRow = {};
          headers.forEach((h, i) => { obj[h] = (r[i] ?? "").toString().trim(); });
          return obj;
        });
        resolve({ headers, rows, hasHeader });
      },
      error: (err) => reject(err),
    });
  });
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  // ExcelJS returns rich objects for some cells (formulas, rich text, dates).
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (typeof v.text === "string") return v.text;
    if ("result" in v && v.result != null) return String(v.result);
    if (value instanceof Date) return value.toISOString();
    return "";
  }
  return String(value);
}

export async function parseXlsx(file: File, hasHeader = true): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("Nessun foglio trovato");

  const aoa: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // row.values is 1-indexed in ExcelJS; slice(1) drops the leading null.
    const values = Array.isArray(row.values) ? (row.values as unknown[]).slice(1) : [];
    for (const v of values) cells.push(cellToString(v));
    aoa.push(cells);
  });

  if (aoa.length === 0) throw new Error("Foglio vuoto");

  const firstRow = aoa[0]!;
  const headers = hasHeader
    ? firstRow.map((h, i) => (h.trim() ? h.trim() : `Col ${i + 1}`))
    : firstRow.map((_, i) => `Col ${i + 1}`);
  const dataRows = hasHeader ? aoa.slice(1) : aoa;

  const rows: ParsedRow[] = dataRows.map((r) => {
    const obj: ParsedRow = {};
    headers.forEach((h, i) => { obj[h] = (r[i] == null ? "" : String(r[i])).trim(); });
    return obj;
  });
  return { headers, rows, hasHeader };
}

// Known unit strings for content-based detection
const KNOWN_UNITS = new Set([
  "kg", "kg.", "g", "gr", "g.", "gr.", "hg",
  "l", "l.", "lt", "lt.", "ml", "cl",
  "pz", "pz.", "cad", "n", "n.", "nr", "nr.",
  "cf", "conf", "conf.", "cassa",
  "cartone", "ct", "bottiglia", "btg", "latta", "confezione",
  "chilogrammo", "chilogrammi", "chilo", "chili", "kilo",
  "grammo", "grammi", "litro", "litri", "millilitro", "millilitri",
  "pezzo", "pezzi", "cadauno", "confezioni", "cartoni", "bottiglie",
]);

function lc(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function scoreColumn(
  header: string,
  values: string[],
): { name: number; unit: number; price: number } {
  const h = lc(header);

  // Header keyword scores
  const nameKeywords  = ["nome", "descrizione", "articolo", "prodotto", "descr", "item", "product", "denominazione", "desc", "artikel"];
  const unitKeywords  = ["unita", "unità", "um", "u.m", "confezione", "conf", "unit", "uom", "misura", "udm", "imballo", "packaging"];
  const priceKeywords = ["prezzo", "costo", "€", "eur", "importo", "price", "cost", "listino", "tariffa", "valore", "pvp", "netto"];

  const nameH  = nameKeywords.some((k)  => h.includes(lc(k))) ? 10 : 0;
  const unitH  = unitKeywords.some((k)  => h.includes(lc(k))) ? 10 : 0;
  const priceH = priceKeywords.some((k) => h.includes(lc(k))) ? 10 : 0;

  if (!values.length) return { name: nameH, unit: unitH, price: priceH };

  // Content scores
  const priceHits = values.filter((v) => {
    const n = normalizePrice(v);
    return n !== null && n > 0;
  }).length;
  const unitHits = values.filter((v) => KNOWN_UNITS.has(lc(v))).length;
  const nameHits = values.filter((v) => v.length > 2 && normalizePrice(v) === null && !KNOWN_UNITS.has(lc(v))).length;

  const ratio = (hits: number) => Math.round((hits / values.length) * 8);

  return {
    name:  nameH  + ratio(nameHits),
    unit:  unitH  + ratio(unitHits),
    price: priceH + ratio(priceHits),
  };
}

/**
 * Suggest best header matches for each target field.
 * When rows are provided, also scores columns by cell content.
 * Returns undefined for a field only when no header has any signal.
 */
export function suggestMapping(
  headers: string[],
  rows: ParsedRow[] = [],
): { name?: string; unit?: string; price?: string } {
  const sample = rows.slice(0, 30);

  const scores = headers.map((h) => {
    const values = sample.map((r) => (r[h] ?? "").trim()).filter(Boolean);
    return { h, ...scoreColumn(h, values) };
  });

  const assigned = new Set<string>();

  const pick = (field: "name" | "unit" | "price"): string | undefined => {
    const best = scores
      .filter((s) => !assigned.has(s.h))
      .sort((a, b) => b[field] - a[field])[0];
    if (best && best[field] > 0) {
      assigned.add(best.h);
      return best.h;
    }
    return undefined;
  };

  // Pick price first (most distinctive), then unit, then name
  const price = pick("price");
  const unit  = pick("unit");
  const name  = pick("name");

  return { name, unit, price };
}
