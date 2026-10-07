// CSV / Excel → SourceDoc. Works in the browser and in Node (tests).

import type { RawSheet, SourceDoc } from "../types.ts";

/** Decode bytes as UTF-8, falling back to Windows-1252 (Excel "CSV (MS-DOS)"). */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(u8);
  }
}

/** Numbers coming from typed spreadsheet cells, rendered unambiguously (comma decimals). */
export function numberCell(n: number): string {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10000) / 10000;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

export async function csvToSourceDoc(text: string, fileName?: string): Promise<SourceDoc> {
  const Papa = (await import("papaparse")).default;
  const res = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    delimitersToGuess: [";", ",", "\t", "|"],
  });
  const rows = (res.data as unknown[][]).map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
  return {
    kind: "csv",
    fileName,
    sheets: [{ name: fileName?.replace(/\.[a-z]+$/i, "") || "CSV", layout: "table", rows }],
  };
}

type ExcelCellValue = unknown;

function excelCellToString(value: ExcelCellValue): string {
  if (value == null) return "";
  if (typeof value === "number") return numberCell(value);
  if (typeof value === "boolean") return value ? "sì" : "no";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: Array<{ text: string }>; hyperlink?: string; error?: string };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.result !== undefined && v.result !== null) return excelCellToString(v.result);
    if (typeof v.text === "string") return v.text;
    if (v.text && typeof v.text === "object") return excelCellToString(v.text);
    if (v.error) return "";
    return "";
  }
  return String(value);
}

/**
 * Every non-empty worksheet as a table sheet. Merged cells keep their value in
 * the top-left cell only, which matches how section headings are written.
 */
export async function xlsxToSourceDoc(buffer: ArrayBuffer, fileName?: string): Promise<SourceDoc> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);
  const sheets: RawSheet[] = [];
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? (row.values as unknown[]).slice(1) : [];
      const cells = Array.from(values, (v) => excelCellToString(v).trim());
      // keep the row index stable relative to content: skip fully empty rows only
      if (cells.some(Boolean)) rows.push(cells);
    });
    if (rows.length > 0) sheets.push({ name: ws.name, layout: "table", rows });
  });
  if (sheets.length === 0) throw new Error("Il file Excel non contiene dati");
  return { kind: "xlsx", fileName, sheets };
}

/** Pasted text → one text sheet, one cell per line. */
export function textToSourceDoc(text: string, name = "Testo incollato"): SourceDoc {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  // Tab-separated paste (copied from Excel / Google Sheets) → table
  const tabRows = lines.filter((l) => l.includes("\t"));
  if (tabRows.length >= 3 && tabRows.length >= lines.filter((l) => l.trim()).length * 0.6) {
    return {
      kind: "text",
      fileName: name,
      sheets: [{ name, layout: "table", rows: lines.filter((l) => l.trim()).map((l) => l.split("\t").map((c) => c.trim())) }],
    };
  }
  return { kind: "text", fileName: name, sheets: [{ name, layout: "text", rows: lines.map((l) => [l]) }] };
}
