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
      skipEmptyLines: "greedy",
      delimitersToGuess: [",", ";", "\t", "|"],
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

// Embedded unit pattern matches "500g", "1,5 kg", "750 ML", "12x33 cl"
const UNIT_TOKEN = "(?:kg|g|gr|grammi?|kilo|chil[oi]|hg|l|lt|litri?|ml|millilitri?|cl|pz|pezzi?|cad(?:auno?)?|cf|conf(?:ezione|ezioni)?|cartone|cartoni|bottigli[ae]|latt[ae])";
const EMBEDDED_UNIT_RE = new RegExp(`\\b(\\d+(?:[.,]\\d+)?\\s*${UNIT_TOKEN})\\b`, "i");

function lc(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Extract a unit-like token from free-text product names.
 * "Pomodori pelati 400 g" \u2192 "400g"; "Olio EVO 1L" \u2192 "1L".
 */
export function extractUnitFromText(text: string): string | null {
  if (!text) return null;
  const m = EMBEDDED_UNIT_RE.exec(text);
  return m ? m[1]!.replace(/\s+/g, "") : null;
}

const SKU_RE = /^[A-Z0-9][A-Z0-9._/-]{1,15}$/i;

function avgLen(values: string[]): number {
  if (!values.length) return 0;
  return values.reduce((a, v) => a + v.length, 0) / values.length;
}

function scoreColumn(
  header: string,
  values: string[],
): { name: number; unit: number; price: number } {
  const h = lc(header);

  // Header keyword scores — heavily weighted so a clear header always wins.
  const nameKeywords  = ["nome", "descrizione", "articolo", "prodotto", "descr", "item", "product", "denominazione", "desc", "artikel"];
  const unitKeywords  = ["unita", "unità", "um", "u.m", "confezione", "conf", "unit", "uom", "misura", "udm", "imballo", "packaging", "peso", "grammatura", "formato", "size", "pezzatura"];
  const priceKeywords = ["prezzo", "costo", "€", "eur", "importo", "price", "cost", "listino", "tariffa", "valore", "pvp", "netto", "lordo"];

  const nameH  = nameKeywords.some((k)  => h.includes(lc(k))) ? 20 : 0;
  const unitH  = unitKeywords.some((k)  => h.includes(lc(k))) ? 20 : 0;
  const priceH = priceKeywords.some((k) => h.includes(lc(k))) ? 20 : 0;

  // Code/SKU columns should not be picked as name
  const codePenalty = /\b(codice|cod\.?|sku|ean|gtin|barcode|id)\b/.test(h) ? -15 : 0;

  if (!values.length) return { name: nameH + codePenalty, unit: unitH, price: priceH };

  // Content scores
  const priceHits = values.filter((v) => {
    const n = normalizePrice(v);
    if (n === null || n <= 0) return false;
    // Long all-digit values are SKUs/barcodes, not prices
    if (/^\d{8,}$/.test(v.replace(/\D/g, ""))) return false;
    return true;
  }).length;
  const unitHits = values.filter((v) => {
    const t = lc(v);
    if (KNOWN_UNITS.has(t)) return true;
    return EMBEDDED_UNIT_RE.test(v);
  }).length;
  const skuHits  = values.filter((v) => SKU_RE.test(v) && normalizePrice(v) === null).length;
  const nameHits = values.filter((v) => v.length > 3 && normalizePrice(v) === null && !KNOWN_UNITS.has(lc(v))).length;

  const ratio = (hits: number) => Math.round((hits / values.length) * 8);

  // Length-based shape signal
  const avg = avgLen(values);
  const nameShape = avg >= 12 ? 4 : avg >= 6 ? 2 : 0;
  const unitShape = avg > 0 && avg <= 10 ? 3 : 0;
  const skuPenalty = skuHits / values.length > 0.7 ? -6 : 0;

  return {
    name:  nameH + ratio(nameHits) + nameShape + codePenalty + skuPenalty,
    unit:  unitH + ratio(unitHits) + unitShape,
    price: priceH + ratio(priceHits),
  };
}

export type DetectedMapping = {
  name?: string;
  unit?: string;
  price?: string;
  scores: { name: number; unit: number; price: number };
  /** All required fields detected AND each above strong-signal threshold. */
  confident: boolean;
};

/**
 * Suggest best header matches for each target field.
 * When rows are provided, also scores columns by cell content.
 * Returns undefined for a field only when no header has any signal.
 */
export function suggestMapping(
  headers: string[],
  rows: ParsedRow[] = [],
): DetectedMapping {
  const sample = rows.slice(0, 30);

  const scores = headers.map((h) => {
    const values = sample.map((r) => (r[h] ?? "").trim()).filter(Boolean);
    return { h, ...scoreColumn(h, values) };
  });

  const assigned = new Set<string>();
  const finalScores = { name: 0, unit: 0, price: 0 };

  const pick = (field: "name" | "unit" | "price"): string | undefined => {
    const best = scores
      .filter((s) => !assigned.has(s.h))
      .sort((a, b) => b[field] - a[field])[0];
    if (best && best[field] > 0) {
      assigned.add(best.h);
      finalScores[field] = best[field];
      return best.h;
    }
    return undefined;
  };

  // Pick price first (most distinctive), then unit, then name
  const price = pick("price");
  const unit  = pick("unit");
  const name  = pick("name");

  // Strong signal = header keyword (20) OR rich content combo (name/price ≥10, unit ≥6)
  const confident = Boolean(name && unit && price)
    && finalScores.name  >= 10
    && finalScores.unit  >= 6
    && finalScores.price >= 10;

  return { name, unit, price, scores: finalScores, confident };
}

/**
 * Heuristic header detection. Header row when most cells are non-empty,
 * non-numeric, and short (< 40 chars). Cheap fallback to user toggle.
 */
export function looksLikeHeader(firstRow: string[]): boolean {
  if (firstRow.length === 0) return false;
  const nonEmpty = firstRow.filter((c) => c && c.trim().length > 0);
  if (nonEmpty.length < Math.ceil(firstRow.length * 0.6)) return false;
  const numeric = nonEmpty.filter((c) => normalizePrice(c) !== null).length;
  if (numeric > nonEmpty.length / 2) return false;
  const tooLong = nonEmpty.filter((c) => c.length > 40).length;
  return tooLong < nonEmpty.length / 2;
}
