/* eslint-disable @typescript-eslint/no-explicit-any */
// Server loaders for goods receiving + HACCP traceability.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { parseLineItems } from "@/lib/analytics/notes-parser";
import { settingsFromRow, toMacroCategory, type HaccpSettings } from "./haccp";
import type { DeliveryIssue, LastCheck, LineCheckMark, ReceivingBlock } from "./types";

export const loadHaccpSettings = cache(async (restaurantId: string): Promise<HaccpSettings> => {
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from("restaurant_haccp_settings")
    .select("traced_categories, traced_keywords, temperature_rules, require_ddt_photo")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) return settingsFromRow(null);
  return settingsFromRow(data);
});

/** Supplier blocks + lines to check for an order (marketplace splits or catalog notes). */
export async function loadReceivingBlocks(order: {
  id: string;
  restaurant_id: string;
  notes: string | null;
}): Promise<ReceivingBlock[]> {
  const supabase = (await createClient()) as any;
  const [splitsRes, itemsRes, relsRes] = await Promise.all([
    supabase.from("order_splits").select("id, supplier_id, status, suppliers(company_name)").eq("order_id", order.id),
    supabase
      .from("order_items")
      .select("id, supplier_id, quantity, products(name, unit, macro_category)")
      .eq("order_id", order.id),
    supabase
      .from("restaurant_suppliers")
      .select("supplier_id")
      .eq("restaurant_id", order.restaurant_id)
      .in("status", ["active", "paused", "pending"]),
  ]);
  const splits = (splitsRes.data ?? []) as {
    id: string;
    supplier_id: string;
    status: string;
    suppliers: { company_name: string } | null;
  }[];
  const items = (itemsRes.data ?? []) as {
    id: string;
    supplier_id: string;
    quantity: number | string;
    products: { name: string; unit: string; macro_category: string | null } | null;
  }[];
  const related = new Set(((relsRes.data ?? []) as { supplier_id: string }[]).map((r) => r.supplier_id));

  if (splits.length > 0) {
    return splits
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        key: s.id,
        splitId: s.id,
        supplierLabel: s.suppliers?.company_name ?? "Fornitore",
        canMessage: related.has(s.supplier_id),
        lines: items
          .filter((i) => i.supplier_id === s.supplier_id)
          .map((i) => {
            const name = i.products?.name ?? "Prodotto";
            return {
              ref: i.id,
              name,
              unit: i.products?.unit ?? null,
              orderedQty: Number(i.quantity),
              category: toMacroCategory(i.products?.macro_category, name),
            };
          }),
      }))
      .filter((b) => b.lines.length > 0);
  }

  // Private-catalog order: lines live in the notes.
  const parsed = parseLineItems(order.notes);
  const blocks: ReceivingBlock[] = [];
  const index = new Map<string, number>();
  for (const li of parsed) {
    let bi = index.get(li.supplier);
    if (bi === undefined) {
      bi = blocks.length;
      index.set(li.supplier, bi);
      blocks.push({ key: `catalog:${bi}`, splitId: null, supplierLabel: li.supplier, canMessage: false, lines: [] });
    }
    const block = blocks[bi]!;
    const unitMatch = li.productName.match(/\(([^()]{1,24})\)\s*$/);
    const name = li.productName.replace(/\s*\([^()]{1,24}\)\s*$/, "").trim() || li.productName;
    block.lines.push({
      ref: `catalog:${bi}:${block.lines.length}`,
      name,
      unit: unitMatch?.[1]?.trim() ?? null,
      orderedQty: li.quantity,
      category: toMacroCategory(null, name),
    });
  }
  return blocks;
}

/** Latest check per order line (marks on the order page) and per supplier block. */
export async function loadOrderChecks(orderId: string): Promise<{
  marks: Record<string, LineCheckMark>;
  checks: LastCheck[];
}> {
  const supabase = (await createClient()) as any;
  const { data: checks, error } = await supabase
    .from("delivery_checks")
    .select("id, supplier_label, outcome, issue_count, message_sent, checked_at")
    .eq("order_id", orderId)
    .order("checked_at", { ascending: false })
    .limit(20);
  if (error || !checks || checks.length === 0) return { marks: {}, checks: [] };
  const ids = (checks as { id: string }[]).map((c) => c.id);
  const { data: lines } = await supabase
    .from("delivery_check_lines")
    .select("check_id, line_ref, issue, received_qty, lot_number, temperature_ok, received_at")
    .in("check_id", ids)
    .order("received_at", { ascending: false });
  const marks: Record<string, LineCheckMark> = {};
  for (const l of (lines ?? []) as {
    line_ref: string;
    issue: DeliveryIssue;
    received_qty: number | string | null;
    lot_number: string | null;
    temperature_ok: boolean | null;
  }[]) {
    if (marks[l.line_ref]) continue; // newest first
    marks[l.line_ref] = {
      issue: l.issue,
      receivedQty: l.received_qty === null ? null : Number(l.received_qty),
      lotNumber: l.lot_number,
      temperatureOk: l.temperature_ok,
    };
  }
  return {
    marks,
    checks: (checks as {
      supplier_label: string | null;
      outcome: "ok" | "issues";
      issue_count: number;
      message_sent: boolean;
      checked_at: string;
    }[]).map((c) => ({
      checkedAt: c.checked_at,
      supplierLabel: c.supplier_label,
      outcome: c.outcome,
      issueCount: c.issue_count,
      messageSent: c.message_sent,
    })),
  };
}
