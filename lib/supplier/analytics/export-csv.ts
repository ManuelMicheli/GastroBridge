"use server";

import { createClient } from "@/lib/supabase/server";
import { computePeriodRange, isPeriodKey, type PeriodKey } from "@/lib/analytics/period";
import { getCurrentSupplierMember, memberCan } from "@/lib/supplier/current-member";
import { REVENUE_SPLIT_STATUSES } from "@/lib/supplier/dashboard/queries";
import { ORDER_STATUS_LABELS } from "@/lib/utils/constants";

type ExportResult =
  | { ok: true; filename: string; content: string }
  | { ok: false; error: string };

type SplitRow = {
  id: string;
  subtotal: number | null;
  status: string;
  orders: { restaurant_id: string; created_at: string } | null;
};

const PAGE_SIZE = 1000;

function csvEscape(value: string): string {
  if (/[",;\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDateItaly(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * CSV of the supplier's revenue orders (splits) in the period — the same rows
 * the analytics KPIs are computed on. Permission: `analytics.financial`.
 */
export async function exportSupplierAnalyticsCsv(period: PeriodKey): Promise<ExportResult> {
  if (!isPeriodKey(period)) return { ok: false, error: "Periodo non valido" };

  const member = await getCurrentSupplierMember();
  if (!member) return { ok: false, error: "Nessun fornitore associato all'utente" };
  if (!memberCan(member, "analytics.financial")) {
    return { ok: false, error: "Non hai i permessi per esportare le analytics" };
  }

  const supabase = await createClient();
  const { from, to, label } = computePeriodRange(period);

  const rows: SplitRow[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = (await supabase
      .from("order_splits")
      .select("id, subtotal, status, orders!inner(restaurant_id, created_at)")
      .eq("supplier_id", member.supplier_id)
      .in("status", REVENUE_SPLIT_STATUSES as unknown as string[])
      .gte("orders.created_at", from.toISOString())
      .lt("orders.created_at", to.toISOString())
      .order("id", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)) as unknown as {
      data: SplitRow[] | null;
      error: { message: string } | null;
    };
    if (error) return { ok: false, error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const restaurantIds = [...new Set(rows.map((r) => r.orders?.restaurant_id).filter((x): x is string => !!x))];
  const nameById = new Map<string, string>();
  for (let i = 0; i < restaurantIds.length; i += 100) {
    const { data } = (await supabase
      .from("restaurants")
      .select("id, name")
      .in("id", restaurantIds.slice(i, i + 100))) as { data: Array<{ id: string; name: string }> | null };
    for (const r of data ?? []) nameById.set(r.id, r.name);
  }

  rows.sort((a, b) => (b.orders?.created_at ?? "").localeCompare(a.orders?.created_at ?? ""));

  const header = ["Data", "Ordine", "Cliente", "Stato", "Imponibile EUR"].map(csvEscape).join(";");
  const body = rows.map((r) =>
    [
      r.orders?.created_at ? formatDateItaly(r.orders.created_at) : "",
      r.id,
      nameById.get(r.orders?.restaurant_id ?? "") ?? "",
      ORDER_STATUS_LABELS[r.status] ?? r.status,
      Number(r.subtotal ?? 0).toFixed(2).replace(".", ","),
    ]
      .map((v) => csvEscape(String(v)))
      .join(";"),
  );

  const today = new Date().toISOString().slice(0, 10);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    ok: true,
    filename: `analytics-fornitore-${slug}-${today}.csv`,
    content: "﻿" + [header, ...body].join("\r\n"),
  };
}
