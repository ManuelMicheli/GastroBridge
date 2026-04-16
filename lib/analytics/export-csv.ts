"use server";

import { createClient } from "@/lib/supabase/server";
import { computePeriodRange, type PeriodKey } from "./period";
import { parseSupplierHeaders, parseLineItems } from "./notes-parser";

type ExportResult =
  | { ok: true; filename: string; content: string }
  | { ok: false; error: string };

type OrderRow = {
  id: string;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
};

function csvEscape(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateItaly(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function exportOrdersCsv(period: PeriodKey): Promise<ExportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non autenticato" };

  const { data: restaurants } = (await supabase
    .from("restaurants")
    .select("id")
    .eq("profile_id", user.id)) as { data: { id: string }[] | null };

  const restaurantIds = restaurants?.map((r) => r.id) ?? [];
  if (restaurantIds.length === 0) {
    return { ok: false, error: "Nessun ristorante associato all'utente" };
  }

  const { from, to, label } = computePeriodRange(period);

  const { data: orders } = (await supabase
    .from("orders")
    .select("id, total, status, notes, created_at")
    .in("restaurant_id", restaurantIds)
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: false })) as { data: OrderRow[] | null };

  const rows = orders ?? [];

  // Header
  const header = [
    "Data",
    "OrderID",
    "Stato",
    "Totale EUR",
    "N.Fornitori",
    "N.Articoli",
    "Fornitori",
    "Note (troncate)",
  ]
    .map(csvEscape)
    .join(";");

  const body = rows.map((o) => {
    const suppliers = parseSupplierHeaders(o.notes);
    const items = parseLineItems(o.notes);
    const supplierNames = suppliers.map((s) => s.name).join(" | ");
    const itemCount = items.length || 0;
    const notesShort = (o.notes ?? "").replace(/\s+/g, " ").slice(0, 200);
    return [
      formatDateItaly(o.created_at),
      o.id,
      o.status,
      (o.total ?? 0).toFixed(2).replace(".", ","),
      String(suppliers.length),
      String(itemCount),
      supplierNames,
      notesShort,
    ]
      .map((v) => csvEscape(String(v)))
      .join(";");
  });

  const content = [header, ...body].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    ok: true,
    filename: `analytics-${slug}-${today}.csv`,
    content: "\ufeff" + content, // BOM so Excel reads UTF-8 correctly
  };
}
