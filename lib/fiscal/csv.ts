// lib/fiscal/csv.ts
// CSV parsing + mapping → NormalizedReceipt grouping.
//
// Expected schema (flexible, auto-detected by header name):
//   receipt_external_id, issued_at, business_day (opt), line_number,
//   item_name, category (opt), quantity, unit_price (euro or cents),
//   vat_rate (opt), discount (opt), payment_method (row 1), total (row 1),
//   operator (opt), covers (opt), table (opt), is_voided (opt)

import Papa from "papaparse";
import type { NormalizedReceipt, NormalizedReceiptItem } from "./types.ts";

export interface CsvMapping {
  receipt_external_id: string;
  issued_at: string;
  line_number: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  business_day?: string;
  category?: string;
  vat_rate?: string;
  discount?: string;
  payment_method?: string;
  operator?: string;
  covers?: string;
  table_ref?: string;
  is_voided?: string;
  total?: string;
}

export interface CsvPreview {
  headers: string[];
  rows: Array<Record<string, string>>;
  rowCount: number;
  autoMapping: CsvMapping | null;
  autoMappingMissing: Array<keyof CsvMapping>;
}

const ALIASES: Record<keyof CsvMapping, string[]> = {
  receipt_external_id: [
    "receipt_external_id",
    "external_id",
    "receipt_id",
    "scontrino_id",
    "id_scontrino",
    "receipt",
  ],
  issued_at: ["issued_at", "data_ora", "datetime", "timestamp", "data", "sell_datetime"],
  business_day: ["business_day", "giornata_fiscale", "giornata"],
  line_number: ["line_number", "line", "riga", "row", "line_num", "linea"],
  item_name: ["item_name", "name", "nome", "prodotto", "descrizione", "descr"],
  category: ["category", "categoria", "group", "reparto"],
  quantity: ["quantity", "qty", "quantita", "qta"],
  unit_price: [
    "unit_price",
    "price",
    "prezzo_unitario",
    "prezzo",
    "unitario",
  ],
  vat_rate: ["vat_rate", "iva", "vat_percentage", "aliquota"],
  discount: ["discount", "sconto", "discount_amount"],
  payment_method: ["payment_method", "pagamento", "payment", "metodo_pagamento"],
  total: ["total", "totale", "amount"],
  operator: ["operator", "operatore", "cashier", "cassiere"],
  covers: ["covers", "coperti", "guests", "persons"],
  table_ref: ["table_ref", "tavolo", "table_name", "table"],
  is_voided: ["is_voided", "annullato", "voided", "cancelled"],
};

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .trim();
}

export function autoDetectMapping(headers: string[]): {
  mapping: CsvMapping | null;
  missing: Array<keyof CsvMapping>;
} {
  const byNorm = new Map(headers.map((h) => [normKey(h), h]));
  const result: Partial<CsvMapping> = {};
  for (const field of Object.keys(ALIASES) as Array<keyof CsvMapping>) {
    for (const alias of ALIASES[field]) {
      const col = byNorm.get(normKey(alias));
      if (col) {
        result[field] = col;
        break;
      }
    }
  }
  const required: Array<keyof CsvMapping> = [
    "receipt_external_id",
    "issued_at",
    "line_number",
    "item_name",
    "quantity",
    "unit_price",
  ];
  const missing = required.filter((k) => !result[k]);
  return {
    mapping: missing.length === 0 ? (result as CsvMapping) : null,
    missing,
  };
}

export function parseCsvPreview(content: string): CsvPreview {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    dynamicTyping: false,
  });
  const headers = parsed.meta.fields ?? [];
  const rows = (parsed.data ?? []).slice(0, 20);
  const rowCount = (parsed.data ?? []).length;
  const detected = autoDetectMapping(headers);
  return {
    headers,
    rows,
    rowCount,
    autoMapping: detected.mapping,
    autoMappingMissing: detected.missing,
  };
}

function parseNumber(v: string | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toCentsFromDisplay(v: string | undefined | null): number {
  // Heuristic: if the value looks like an int >= 1000 AND has no decimal dot
  // assume already cents. Otherwise treat as euros and multiply × 100.
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  if (!s.includes(".") && s.length >= 4 && /^\d+$/.test(s)) {
    return Math.round(Number(s));
  }
  return Math.round(parseNumber(s) * 100);
}

function parseBool(v: string | undefined | null): boolean {
  if (!v) return false;
  const s = v.toLowerCase().trim();
  return s === "true" || s === "1" || s === "si" || s === "y" || s === "yes";
}

function normaliseIssuedAt(v: string): string {
  // Accept ISO 8601 directly. Otherwise try Date() and fall back to literal.
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v;
  const d = new Date(v);
  if (!Number.isNaN(d.valueOf())) return d.toISOString();
  return v;
}

export interface CsvBuildError {
  row: number;
  message: string;
}

export interface CsvBuildResult {
  receipts: NormalizedReceipt[];
  errors: CsvBuildError[];
}

export function buildReceiptsFromCsv(
  content: string,
  mapping: CsvMapping,
): CsvBuildResult {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    dynamicTyping: false,
  });
  const rows = parsed.data ?? [];
  const byReceipt = new Map<
    string,
    {
      header: Omit<NormalizedReceipt, "items">;
      items: NormalizedReceiptItem[];
      totalFromCsv: number | null;
    }
  >();
  const errors: CsvBuildError[] = [];

  rows.forEach((row, idx) => {
    const rowIdx = idx + 2; // +1 for header, +1 for 1-based
    try {
      const externalId = (row[mapping.receipt_external_id] ?? "").trim();
      if (!externalId) throw new Error("missing receipt_external_id");
      const issuedAtRaw = (row[mapping.issued_at] ?? "").trim();
      if (!issuedAtRaw) throw new Error("missing issued_at");
      const issuedAt = normaliseIssuedAt(issuedAtRaw);
      const businessDay =
        (mapping.business_day && row[mapping.business_day]
          ? row[mapping.business_day]!
          : issuedAt.slice(0, 10)) || issuedAt.slice(0, 10);

      const lineNumber = Math.round(parseNumber(row[mapping.line_number]));
      if (!Number.isFinite(lineNumber) || lineNumber <= 0) {
        throw new Error(`invalid line_number`);
      }

      const quantity = parseNumber(row[mapping.quantity]);
      if (quantity <= 0) throw new Error("quantity must be > 0");

      const unitCents = toCentsFromDisplay(row[mapping.unit_price]);
      const discountCents = mapping.discount
        ? toCentsFromDisplay(row[mapping.discount])
        : 0;
      const subtotalCents = Math.max(0, unitCents * quantity - discountCents);
      const vatRate = mapping.vat_rate
        ? parseNumber(row[mapping.vat_rate])
        : null;
      const isVoided = mapping.is_voided
        ? parseBool(row[mapping.is_voided])
        : false;

      let entry = byReceipt.get(externalId);
      if (!entry) {
        const paymentMethod = mapping.payment_method
          ? (row[mapping.payment_method]?.trim() || null)
          : null;
        const operator = mapping.operator
          ? (row[mapping.operator]?.trim() || null)
          : null;
        const covers = mapping.covers
          ? Math.round(parseNumber(row[mapping.covers])) || null
          : null;
        const tableRef = mapping.table_ref
          ? (row[mapping.table_ref]?.trim() || null)
          : null;
        const totalFromCsv =
          mapping.total && row[mapping.total]
            ? toCentsFromDisplay(row[mapping.total])
            : null;
        entry = {
          header: {
            external_id: externalId,
            issued_at: issuedAt,
            business_day: businessDay,
            status: "issued",
            subtotal_cents: 0,
            vat_cents: 0,
            total_cents: 0,
            payment_method: paymentMethod,
            operator_name: operator,
            table_ref: tableRef,
            covers,
            metadata: { source: "csv_upload" },
          } as Omit<NormalizedReceipt, "items">,
          items: [],
          totalFromCsv,
        };
        byReceipt.set(externalId, entry);
      }

      const item: NormalizedReceiptItem = {
        line_number: lineNumber,
        pos_item_id: null,
        name: (row[mapping.item_name] ?? "").trim() || "—",
        category:
          mapping.category && row[mapping.category]
            ? row[mapping.category]!.trim() || null
            : null,
        quantity,
        unit_price_cents: unitCents,
        subtotal_cents: subtotalCents,
        vat_rate: vatRate,
        discount_cents: discountCents,
        is_voided: isVoided,
      };
      entry.items.push(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ row: rowIdx, message: msg });
    }
  });

  const receipts: NormalizedReceipt[] = [];
  for (const entry of byReceipt.values()) {
    const subtotal = entry.items.reduce((s, i) => s + i.subtotal_cents, 0);
    let total = entry.totalFromCsv;
    let vat: number;
    if (total !== null) {
      vat = Math.max(0, total - subtotal);
    } else {
      // Derive VAT from declared rates per item
      const declared = entry.items.reduce(
        (s, i) =>
          s + Math.round((i.subtotal_cents * (i.vat_rate ?? 0)) / 100),
        0,
      );
      vat = declared;
      total = subtotal + vat;
    }
    receipts.push({
      ...entry.header,
      subtotal_cents: subtotal,
      vat_cents: vat,
      total_cents: total,
      items: entry.items.sort((a, b) => a.line_number - b.line_number),
    });
  }

  return { receipts, errors };
}
