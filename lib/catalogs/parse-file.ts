"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";

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

export async function parseXlsx(file: File, hasHeader = true): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Nessun foglio trovato");
  const sheet = wb.Sheets[firstSheetName]!;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  if (aoa.length === 0) throw new Error("Foglio vuoto");

  const firstRow = aoa[0]!.map((v) => (v == null ? "" : String(v)));
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

/** Suggest best header matches for each target field. */
export function suggestMapping(headers: string[]): { name?: string; unit?: string; price?: string } {
  const lc = (s: string) => s.toLowerCase();
  const nameCandidates  = ["nome", "descrizione", "articolo", "prodotto", "descr"];
  const unitCandidates  = ["unita", "unità", "um", "u.m.", "u.m", "confezione"];
  const priceCandidates = ["prezzo", "costo", "€", "eur", "importo"];

  const find = (cands: string[]) => headers.find((h) => cands.some((c) => lc(h).includes(c)));

  return { name: find(nameCandidates), unit: find(unitCandidates), price: find(priceCandidates) };
}
