// Test helpers for the import corpus (Node only).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ExtractionResult, SourceDoc } from "../../lib/import/types.ts";
import { csvToSourceDoc, decodeText, textToSourceDoc, xlsxToSourceDoc } from "../../lib/import/formats/spreadsheet.ts";
import { pdfToSourceDoc } from "../../lib/import/formats/pdf.ts";
import { similarity } from "../../lib/import/match/similarity.ts";

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "import");

export function fixturePath(name: string): string {
  return path.join(FIXTURES, name);
}

// ---------------------------------------------------------------------------
// Minimal PDF writer (Helvetica, WinAnsi) — enough to test text extraction.
// ---------------------------------------------------------------------------

type Run = { x: number; y: number; size: number; text: string };

function pdfString(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (ch === "€") out += "\\200";
    else {
      const code = ch.charCodeAt(0);
      out += code > 126 ? `\\${code.toString(8).padStart(3, "0")}` : ch;
    }
  }
  return out;
}

export function buildPdf(runs: Run[], page = { width: 595, height: 842 }): Uint8Array {
  const content = runs
    .map((r) => `BT /F1 ${r.size} Tf 1 0 0 1 ${r.x} ${r.y} Tm (${pdfString(r.text)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

// ---------------------------------------------------------------------------
// Fixture → SourceDoc
// ---------------------------------------------------------------------------

export async function loadFixture(name: string, kind: string): Promise<SourceDoc> {
  const p = fixturePath(name);
  if (kind === "csv") return csvToSourceDoc(decodeText(readFileSync(p)), name);
  if (kind === "text") return textToSourceDoc(readFileSync(p, "utf8"), name);
  if (kind === "image") {
    // Simulated OCR output: text lines, columns separated by wide gaps.
    const rows = readFileSync(p, "utf8")
      .split("\n")
      .map((l) => l.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean))
      .filter((r) => r.length > 0);
    return { kind: "image", fileName: name, sheets: [{ name: "Foto", layout: "grid", rows }], meta: { ocrConfidence: 0.82, ocrPages: 1 } };
  }
  if (kind === "xlsx") {
    const spec = JSON.parse(readFileSync(p, "utf8")) as { sheets: Array<{ name: string; rows: unknown[][] }> };
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    for (const sh of spec.sheets) {
      const ws = wb.addWorksheet(sh.name);
      for (const r of sh.rows) ws.addRow(r);
    }
    const buf = await wb.xlsx.writeBuffer();
    return xlsxToSourceDoc(buf as ArrayBuffer, name.replace(".json", ".xlsx"));
  }
  if (kind === "pdf") {
    const spec = JSON.parse(readFileSync(p, "utf8")) as { page: { width: number; height: number }; runs: Run[] };
    const bytes = buildPdf(spec.runs, spec.page);
    return pdfToSourceDoc(bytes, { pdfjs: await loadPdfJs(), fileName: name.replace(".json", ".pdf") });
  }
  throw new Error(`unknown fixture kind ${kind}`);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type GoldProduct = {
  name: string;
  price: number;
  unit: string | string[];
  category: string | string[];
  vat?: number | null;
  available?: boolean;
};

export type Gold = {
  kind: string;
  supplier: Record<string, unknown>;
  pricesIncludeVat?: boolean;
  products: GoldProduct[];
};

export type Score = {
  expected: number;
  extracted: number;
  found: number;
  nameOk: number;
  priceOk: number;
  unitOk: number;
  categoryOk: number;
  extraOk: number;
  extraTotal: number;
  supplierOk: number;
  supplierTotal: number;
  failures: string[];
};

export function scoreResult(res: ExtractionResult, gold: Gold): Score {
  const s: Score = {
    expected: gold.products.length, extracted: res.products.length, found: 0, nameOk: 0, priceOk: 0, unitOk: 0,
    categoryOk: 0, extraOk: 0, extraTotal: 0, supplierOk: 0, supplierTotal: 0, failures: [],
  };
  const used = new Set<string>();
  for (const g of gold.products) {
    let best: { id: string; score: number } | null = null;
    for (const p of res.products) {
      if (used.has(p.id)) continue;
      const sc = similarity(g.name, p.name);
      if (sc >= 0.6 && (!best || sc > best.score)) best = { id: p.id, score: sc };
    }
    if (!best) {
      s.failures.push(`MISSING ${g.name}`);
      continue;
    }
    used.add(best.id);
    const p = res.products.find((x) => x.id === best!.id)!;
    s.found++;
    if (best.score >= 0.8) s.nameOk++;
    else s.failures.push(`NAME "${p.name}" ≠ "${g.name}" (${best.score.toFixed(2)})`);
    if (p.price !== null && Math.abs(p.price - g.price) < 0.005) s.priceOk++;
    else s.failures.push(`PRICE ${g.name}: ${p.price} ≠ ${g.price}`);
    const units = Array.isArray(g.unit) ? g.unit : [g.unit];
    if (units.includes(p.priceUnit)) s.unitOk++;
    else s.failures.push(`UNIT ${g.name}: ${p.priceUnit} ∉ ${units.join("/")}`);
    if ((Array.isArray(g.category) ? g.category : [g.category]).includes(p.category)) s.categoryOk++;
    else s.failures.push(`CATEGORY ${g.name}: ${p.category} ≠ ${g.category}`);
    if (g.vat !== undefined) {
      s.extraTotal++;
      if (p.vatRate === g.vat) s.extraOk++;
      else s.failures.push(`VAT ${g.name}: ${p.vatRate} ≠ ${g.vat}`);
    }
    if (g.available !== undefined) {
      s.extraTotal++;
      if (p.available === g.available) s.extraOk++;
      else s.failures.push(`AVAILABLE ${g.name}: ${p.available} ≠ ${g.available}`);
    }
  }
  for (const p of res.products) if (!used.has(p.id)) s.failures.push(`EXTRA "${p.name}" ${p.price}`);

  const sup = res.supplier as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(gold.supplier)) {
    s.supplierTotal++;
    let ok = false;
    const got = sup[k];
    if (k === "name") ok = typeof got === "string" && similarity(got, String(v)) >= 0.8;
    else if (Array.isArray(v)) {
      const list = k === "emails" ? [...((got as string[]) ?? []), ...(res.supplier.pec ? [res.supplier.pec] : [])] : ((got as unknown[]) ?? []);
      ok = k === "deliveryDays" ? JSON.stringify(got) === JSON.stringify(v) : v.every((x) => list.includes(x));
    } else ok = got === v;
    if (ok) s.supplierOk++;
    else s.failures.push(`SUPPLIER ${k}: ${JSON.stringify(got)} ≠ ${JSON.stringify(v)}`);
  }
  if (gold.pricesIncludeVat !== undefined) {
    s.supplierTotal++;
    if (res.pricesIncludeVat === gold.pricesIncludeVat) s.supplierOk++;
    else s.failures.push(`PRICES_INCLUDE_VAT ${res.pricesIncludeVat} ≠ ${gold.pricesIncludeVat}`);
  }
  return s;
}

export const pct = (a: number, b: number) => (b === 0 ? 1 : a / b);
