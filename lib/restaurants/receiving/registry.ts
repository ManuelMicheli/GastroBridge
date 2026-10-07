/* eslint-disable @typescript-eslint/no-explicit-any */
// Registro di tracciabilità (Reg. CE 178/2002): received lines searchable by
// product / lot / supplier / date. Shared by /tracciabilita and its export route.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { romeWallTimeToUtc } from "@/lib/restaurants/ordering/schedule";
import type { DeliveryIssue } from "./types";

export type RegistryFilters = {
  q: string;
  lot: string;
  supplier: string;
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
  onlyTraced: boolean;
  onlyIssues: boolean;
};

export type RegistryRow = {
  lineId: string;
  receivedAt: string;
  orderId: string;
  supplierLabel: string;
  productName: string;
  unit: string | null;
  category: string | null;
  orderedQty: number | null;
  receivedQty: number | null;
  issue: DeliveryIssue;
  note: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  temperatureC: number | null;
  temperatureOk: boolean | null;
  ddtNumber: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function filtersFromParams(sp: Record<string, string | string[] | undefined>): RegistryFilters {
  const s = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) ?? "";
  };
  return {
    q: s("q"),
    lot: s("lot"),
    supplier: s("fornitore"),
    from: DATE_RE.test(s("dal")) ? s("dal") : null,
    to: DATE_RE.test(s("al")) ? s("al") : null,
    onlyTraced: s("tracciati") === "1",
    onlyIssues: s("problemi") === "1",
  };
}

/** PostgREST ilike pattern with user wildcards escaped. */
function like(v: string): string {
  return `%${v.replace(/[\\%_,()]/g, (c) => `\\${c}`)}%`;
}

export async function queryRegistry(
  scopeIds: string[],
  f: RegistryFilters,
  limit = 500,
): Promise<{ rows: RegistryRow[]; truncated: boolean; unavailable: boolean }> {
  if (scopeIds.length === 0) return { rows: [], truncated: false, unavailable: false };
  const supabase = (await createClient()) as any;
  let q = supabase
    .from("restaurant_received_lines")
    .select(
      "line_id, received_at, order_id, supplier_label, product_name, unit, category, ordered_qty, received_qty, issue, note, lot_number, expiry_date, temperature_c, temperature_ok, ddt_number",
    )
    .in("restaurant_id", scopeIds)
    .order("received_at", { ascending: false })
    .limit(limit + 1);
  if (f.q) q = q.ilike("product_name", like(f.q));
  if (f.lot) q = q.ilike("lot_number", like(f.lot));
  if (f.supplier) q = q.ilike("supplier_label", like(f.supplier));
  const romeIso = (d: string, hh: number, mm: number) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(romeWallTimeToUtc(y!, m!, day!, hh, mm)).toISOString();
  };
  if (f.from) q = q.gte("received_at", romeIso(f.from, 0, 0));
  if (f.to) q = q.lt("received_at", new Date(Date.parse(romeIso(f.to, 23, 59)) + 60_000).toISOString());
  if (f.onlyTraced) q = q.not("lot_number", "is", null);
  if (f.onlyIssues) q = q.or("issue.neq.ok,temperature_ok.eq.false");

  const { data, error } = await q;
  if (error) return { rows: [], truncated: false, unavailable: true };
  const list = (data ?? []) as any[];
  return {
    truncated: list.length > limit,
    unavailable: false,
    rows: list.slice(0, limit).map((r) => ({
      lineId: r.line_id,
      receivedAt: r.received_at,
      orderId: r.order_id,
      supplierLabel: r.supplier_label ?? "Fornitore",
      productName: r.product_name,
      unit: r.unit,
      category: r.category,
      orderedQty: r.ordered_qty === null ? null : Number(r.ordered_qty),
      receivedQty: r.received_qty === null ? null : Number(r.received_qty),
      issue: r.issue,
      note: r.note,
      lotNumber: r.lot_number,
      expiryDate: r.expiry_date,
      temperatureC: r.temperature_c === null ? null : Number(r.temperature_c),
      temperatureOk: r.temperature_ok,
      ddtNumber: r.ddt_number,
    })),
  };
}

const romeDateTime = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatReceivedAt(iso: string): string {
  return romeDateTime.format(new Date(iso));
}

export function formatExpiry(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const num = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** Semicolon CSV with BOM (opens correctly in Italian Excel). */
export function registryToCsv(rows: RegistryRow[], issueLabels: Record<string, string>): string {
  const header = [
    "Data ricevimento",
    "Fornitore",
    "Prodotto",
    "Categoria",
    "Lotto",
    "Scadenza",
    "Temperatura °C",
    "Temperatura conforme",
    "Quantità ordinata",
    "Quantità ricevuta",
    "Unità",
    "Esito",
    "Note",
    "DDT",
    "Ordine",
  ];
  const lines = rows.map((r) =>
    [
      formatReceivedAt(r.receivedAt),
      r.supplierLabel,
      r.productName,
      r.category ?? "",
      r.lotNumber ?? "",
      formatExpiry(r.expiryDate),
      num(r.temperatureC),
      r.temperatureOk === null ? "" : r.temperatureOk ? "sì" : "NO",
      num(r.orderedQty),
      num(r.receivedQty),
      r.unit ?? "",
      issueLabels[r.issue] ?? r.issue,
      r.note ?? "",
      r.ddtNumber ?? "",
      r.orderId.slice(0, 8),
    ]
      .map(csvCell)
      .join(";"),
  );
  return "﻿" + [header.join(";"), ...lines].join("\r\n");
}
