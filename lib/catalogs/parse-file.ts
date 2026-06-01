"use client";

import { normalizePrice } from "./normalize";

// papaparse (~45KB) and exceljs (~900KB parsed) are loaded on demand inside the
// parse functions below — they stay out of every chunk that only needs the pure
// helpers (suggestMapping/looksLikeHeader/extractUnitFromText/detectLayout), and
// out of the import-wizard chunk until the user actually parses a file.

export type ParsedRow = Record<string, string>;
export type ParsedSheet = {
  headers: string[];      // unique; from the detected header row, else ["Col 1", ...]
  rows: ParsedRow[];      // keyed by header
  hasHeader: boolean;
};

// ---------------------------------------------------------------------------
// Raw readers: file → array-of-arrays (no header assumptions made here).
// ---------------------------------------------------------------------------

async function csvToAoa(file: File): Promise<string[][]> {
  const Papa = (await import("papaparse")).default;
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: "greedy",
      delimitersToGuess: [",", ";", "\t", "|"],
      complete: (res) => {
        const rows = (res.data as string[][]).map((r) =>
          r.map((c) => (c ?? "").toString().trim()),
        );
        if (rows.length === 0) { reject(new Error("File vuoto")); return; }
        resolve(rows);
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

/** Read every worksheet into its own array-of-arrays. */
async function xlsxToSheetsAoa(file: File): Promise<string[][][]> {
  const ExcelJS = (await import("exceljs")).default;
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const sheets: string[][][] = [];
  wb.worksheets.forEach((sheet) => {
    const aoa: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      // row.values is 1-indexed in ExcelJS; slice(1) drops the leading null.
      const values = Array.isArray(row.values) ? (row.values as unknown[]).slice(1) : [];
      for (const v of values) cells.push(cellToString(v).trim());
      aoa.push(cells);
    });
    if (aoa.length) sheets.push(aoa);
  });
  if (sheets.length === 0) throw new Error("Nessun foglio con dati trovato");
  return sheets;
}

// ---------------------------------------------------------------------------
// Header / row helpers.
// ---------------------------------------------------------------------------

/** Build unique header names so duplicate or empty columns never collide. */
function makeHeaders(cells: string[], width: number, hasHeader: boolean): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < width; i++) {
    let base = hasHeader ? (cells[i] ?? "").trim() : "";
    if (!base) base = `Col ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push(n === 0 ? base : `${base} (${n + 1})`);
  }
  return out;
}

function rowWidth(aoa: string[][]): number {
  return aoa.reduce((w, r) => Math.max(w, r.length), 0);
}

function nonEmptyCount(row: string[]): number {
  return row.filter((c) => c && c.trim().length > 0).length;
}

/** Turn an AOA + a chosen header row into keyed rows. */
function buildSheet(aoa: string[][], headerRowIndex: number, hasHeader: boolean): ParsedSheet {
  const width = rowWidth(aoa);
  const headers = makeHeaders(hasHeader ? (aoa[headerRowIndex] ?? []) : [], width, hasHeader);
  const dataRows = hasHeader ? aoa.slice(headerRowIndex + 1) : aoa.slice(headerRowIndex);
  const rows: ParsedRow[] = dataRows
    .filter((r) => nonEmptyCount(r) > 0)
    .map((r) => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").toString().trim(); });
      return obj;
    });
  return { headers, rows, hasHeader };
}

// ---------------------------------------------------------------------------
// Backward-compatible parsers (supplier wizard + cerca still call these with an
// explicit hasHeader flag).
// ---------------------------------------------------------------------------

export async function parseCsv(file: File, hasHeader = true): Promise<ParsedSheet> {
  const aoa = await csvToAoa(file);
  return buildSheet(aoa, 0, hasHeader);
}

export async function parseXlsx(file: File, hasHeader = true): Promise<ParsedSheet> {
  const sheets = await xlsxToSheetsAoa(file);
  return buildSheet(sheets[0]!, 0, hasHeader);
}

// ---------------------------------------------------------------------------
// Unit detection.
// ---------------------------------------------------------------------------

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

const UNIT_TOKEN = "(?:kg|g|gr|grammi?|kilo|chil[oi]|hg|l|lt|litri?|ml|millilitri?|cl|pz|pezzi?|cad(?:auno?)?|cf|conf(?:ezione|ezioni)?|cartone|cartoni|bottigli[ae]|latt[ae])";
const EMBEDDED_UNIT_RE = new RegExp(`\\b(\\d+(?:[.,]\\d+)?\\s*${UNIT_TOKEN})\\b`, "i");

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function lc(s: string) {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

/**
 * Extract a unit-like token from free-text product names.
 * "Pomodori pelati 400 g" → "400g"; "Olio EVO 1L" → "1L".
 */
export function extractUnitFromText(text: string): string | null {
  if (!text) return null;
  const m = EMBEDDED_UNIT_RE.exec(text);
  return m ? m[1]!.replace(/\s+/g, "") : null;
}

const SKU_RE = /^[A-Z0-9][A-Z0-9._/-]{1,15}$/i;
const BARCODE_RE = /^\d{8,}$/;

function avgLen(values: string[]): number {
  if (!values.length) return 0;
  return values.reduce((a, v) => a + v.length, 0) / values.length;
}

// Multilingual header keywords (it / en / de / fr / es).
const NAME_KEYWORDS  = ["nome", "descrizione", "descr", "desc", "articolo", "prodotto", "denominazione", "item", "product", "description", "artikel", "bezeichnung", "designation", "libelle", "producto", "descripcion"];
const UNIT_KEYWORDS  = ["unita", "unità", "um", "u.m", "udm", "confezione", "conf", "unit", "uom", "misura", "imballo", "packaging", "peso", "grammatura", "formato", "size", "pezzatura", "contenuto", "einheit", "menge", "unite", "quantite", "cantidad", "formato", "tamano"];
const PRICE_KEYWORDS = ["prezzo", "costo", "€", "eur", "importo", "price", "cost", "listino", "tariffa", "valore", "pvp", "netto", "lordo", "amount", "preis", "prix", "precio", "tarif"];

function scoreColumn(
  header: string,
  values: string[],
): { name: number; unit: number; price: number } {
  const h = lc(header);

  // Header keyword scores — heavily weighted so a clear header always wins.
  const nameH  = NAME_KEYWORDS.some((k)  => h.includes(lc(k))) ? 20 : 0;
  const unitH  = UNIT_KEYWORDS.some((k)  => h.includes(lc(k))) ? 20 : 0;
  const priceH = PRICE_KEYWORDS.some((k) => h.includes(lc(k))) ? 20 : 0;

  // Code/SKU columns should not be picked as name.
  const codePenalty = /\b(codice|cod\.?|sku|ean|gtin|barcode|id|art\.?)\b/.test(h) ? -15 : 0;

  if (!values.length) return { name: nameH + codePenalty, unit: unitH, price: priceH };

  // Content scores.
  // Prices that carry a decimal separator or currency are "strong" — this is
  // what separates a real price column from an integer SKU/quantity column,
  // which would otherwise also parse as a number.
  const priceStrong = values.filter((v) => {
    if (BARCODE_RE.test(v.replace(/\D/g, ""))) return false;
    const n = normalizePrice(v);
    if (n === null || n <= 0) return false;
    return /[.,]/.test(v) || /€|eur|euro/i.test(v);
  }).length;
  const priceAny = values.filter((v) => {
    if (BARCODE_RE.test(v.replace(/\D/g, ""))) return false;
    const n = normalizePrice(v);
    return n !== null && n > 0;
  }).length;

  const unitHits = values.filter((v) => {
    const t = lc(v);
    if (KNOWN_UNITS.has(t)) return true;
    return EMBEDDED_UNIT_RE.test(v);
  }).length;
  const skuHits  = values.filter((v) => SKU_RE.test(v) && normalizePrice(v) === null).length;
  const nameHits = values.filter((v) => v.length > 3 && normalizePrice(v) === null && !KNOWN_UNITS.has(lc(v))).length;

  const ratio = (hits: number) => Math.round((hits / values.length) * 10);

  // Length-based shape signal.
  const avg = avgLen(values);
  const nameShape = avg >= 12 ? 4 : avg >= 6 ? 2 : 0;
  const unitShape = avg > 0 && avg <= 10 ? 3 : 0;
  const skuPenalty = skuHits / values.length > 0.7 ? -6 : 0;

  // Strong (decimal/currency) prices score full content weight; integer-only
  // numeric columns get half — enough to be a fallback, not enough to beat a
  // real price column.
  const priceContent = priceStrong > 0
    ? ratio(priceStrong)
    : Math.round(ratio(priceAny) / 2);

  return {
    name:  nameH + ratio(nameHits) + nameShape + codePenalty + skuPenalty,
    unit:  unitH + ratio(unitHits) + unitShape,
    price: priceH + priceContent,
  };
}

export type DetectedMapping = {
  name?: string;
  unit?: string;
  price?: string;
  scores: { name: number; unit: number; price: number };
  /** Name + price found and each above its strong-signal threshold. Unit is
   *  optional (it can be derived from the name or defaulted), so it does not
   *  gate confidence. */
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

  // Pick price first (most distinctive), then name, then unit. Name is the
  // must-have field; unit is picked last because product names often contain an
  // embedded unit ("Pomodori 400g") and would otherwise steal the name column —
  // a missing unit is recoverable (derived from the name or defaulted).
  const price = pick("price");
  const name  = pick("name");
  const unit  = pick("unit");

  // Confident = we trust it enough to import without asking. Name must have a
  // header keyword (20) or rich text content (≥8); price must have a keyword
  // (20) or all-decimal/currency content (≥10).
  const confident = Boolean(name && price)
    && finalScores.name  >= 8
    && finalScores.price >= 10;

  return { name, unit, price, scores: finalScores, confident };
}

/**
 * Heuristic header detection. Header row when most cells are non-empty,
 * non-numeric, and short (< 40 chars).
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

// ---------------------------------------------------------------------------
// Layout detection: find the real header row (skipping preamble/title/logo
// rows) and decide whether the sheet has a header at all.
// ---------------------------------------------------------------------------

export type DetectedLayout = {
  headerRowIndex: number;
  hasHeader: boolean;
  mapping: DetectedMapping;
  score: number;
};

function sampleObjs(aoa: string[][], headers: string[], from: number): ParsedRow[] {
  return aoa.slice(from, from + 30)
    .filter((r) => nonEmptyCount(r) > 0)
    .map((r) => {
      const obj: ParsedRow = {};
      headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
      return obj;
    });
}

/**
 * Scan the first rows of a sheet and pick the layout (header row + hasHeader)
 * that yields the strongest column mapping. Lets us auto-handle catalogs that
 * start with title/blank/logo rows, and files with no header at all.
 */
export function detectLayout(aoa: string[][]): DetectedLayout {
  const width = rowWidth(aoa);
  const limit = Math.min(12, aoa.length);
  let best: DetectedLayout | null = null;

  const mappingScore = (m: DetectedMapping) =>
    m.scores.name + m.scores.unit + m.scores.price + (m.confident ? 100 : 0);

  // A real header row labels columns — it should not itself contain prices or
  // bare units. If it does, we'd be eating an actual data row as the header.
  const looksLikeData = (row: string[]) =>
    row.some((c) => /\d[.,]\d/.test(c) && normalizePrice(c) !== null)
    || row.some((c) => KNOWN_UNITS.has(lc(c.trim())));

  // Candidate 1..N: each early row treated as a header, data below it.
  for (let i = 0; i < limit; i++) {
    const row = aoa[i] ?? [];
    if (nonEmptyCount(row) < 2) continue;          // skip title/preamble rows
    if (i + 1 >= aoa.length) continue;
    const headers = makeHeaders(row, width, true);
    const objs = sampleObjs(aoa, headers, i + 1);
    if (objs.length === 0) continue;
    const m = suggestMapping(headers, objs);
    // Bias toward header-looking rows and earlier rows (preamble penalty);
    // heavily penalize candidates whose "header" is really a data row.
    const score = mappingScore(m) + (looksLikeHeader(row) ? 15 : 0) - i * 3
      - (looksLikeData(row) ? 80 : 0);
    if (!best || score > best.score) {
      best = { headerRowIndex: i, hasHeader: true, mapping: m, score };
    }
  }

  // Candidate 0: no header — first non-empty row is already data.
  const firstData = aoa.findIndex((r) => nonEmptyCount(r) >= 2);
  if (firstData >= 0) {
    const headers = makeHeaders([], width, false);
    const objs = sampleObjs(aoa, headers, firstData);
    if (objs.length) {
      const m = suggestMapping(headers, objs);
      // Slight penalty so a genuine header wins ties.
      const score = mappingScore(m) - 8;
      if (!best || score > best.score) {
        best = { headerRowIndex: firstData, hasHeader: false, mapping: m, score };
      }
    }
  }

  // Fallback: assume row 0 is a header.
  if (!best) {
    const headers = makeHeaders(aoa[0] ?? [], width, true);
    best = { headerRowIndex: 0, hasHeader: true, mapping: suggestMapping(headers, sampleObjs(aoa, headers, 1)), score: 0 };
  }
  return best;
}

export type SmartParse = {
  sheet: ParsedSheet;
  mapping: DetectedMapping;
};

/**
 * One-call parse: read the file, pick the best worksheet (for xlsx), detect the
 * header row and column mapping automatically. No hasHeader flag needed.
 */
export async function parseSmart(file: File): Promise<SmartParse> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  let sheets: string[][][];
  if (ext === "csv") sheets = [await csvToAoa(file)];
  else if (ext === "xlsx" || ext === "xls") sheets = await xlsxToSheetsAoa(file);
  else throw new Error("Formato non supportato");

  // Pick the worksheet whose best layout scores highest.
  let chosen: { aoa: string[][]; layout: DetectedLayout } | null = null;
  for (const aoa of sheets) {
    if (aoa.length === 0) continue;
    const layout = detectLayout(aoa);
    if (!chosen || layout.score > chosen.layout.score) chosen = { aoa, layout };
  }
  if (!chosen) throw new Error("Nessun dato leggibile nel file");

  const { aoa, layout } = chosen;
  const sheet = buildSheet(aoa, layout.headerRowIndex, layout.hasHeader);
  if (sheet.rows.length === 0) throw new Error("Nessuna riga di dati nel file");
  return { sheet, mapping: layout.mapping };
}
