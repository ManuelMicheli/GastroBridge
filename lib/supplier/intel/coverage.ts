/* eslint-disable @typescript-eslint/no-explicit-any */
// Stock coverage of pending order lines — predicts, before the supplier
// accepts, whether `reserve_split_tx` would succeed.
//
// Mirrors the RPC on purpose: availability is SUM(quantity_base -
// quantity_reserved_base) of the lots of the product in the split's
// warehouse (or the supplier's primary warehouse, which `ensureSplitWarehouse`
// would assign), compared with the requested quantity as the RPC does.
// Splits are evaluated in the order given (oldest first) and consume the
// availability cumulatively, so a bulk accept of N orders is predicted
// honestly. Suppliers without any warehouse do not reserve stock at all →
// "untracked".

import type { SupabaseClient } from "@supabase/supabase-js";

export type CoverageStatus = "covered" | "partial" | "uncovered" | "untracked";

export type LineCoverage = {
  lineId: string;
  productId: string;
  requested: number;
  available: number;
  short: number;
  /** Earliest expiry among lots with free quantity (FEFO first pick). */
  firstExpiry: string | null;
};

export type SplitCoverage = {
  splitId: string;
  status: CoverageStatus;
  lines: LineCoverage[];
  shortLines: number;
};

export type CoverageSplitInput = { id: string; warehouse_id: string | null };
export type CoverageLineInput = {
  id: string;
  order_split_id: string;
  product_id: string;
  quantity_requested: number;
  status: string;
};

type Lot = {
  product_id: string;
  warehouse_id: string;
  quantity_base: number;
  quantity_reserved_base: number;
  expiry_date: string | null;
};

export async function computeStockCoverage(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  splits: CoverageSplitInput[],
  lines: CoverageLineInput[],
): Promise<Map<string, SplitCoverage>> {
  const out = new Map<string, SplitCoverage>();
  if (splits.length === 0) return out;

  const { data: whRows } = (await (supabase as any)
    .from("warehouses")
    .select("id, is_primary, is_active")
    .eq("supplier_id", supplierId)) as {
    data: { id: string; is_primary: boolean | null; is_active: boolean | null }[] | null;
  };
  const warehouses = whRows ?? [];
  if (warehouses.length === 0) {
    for (const s of splits) {
      out.set(s.id, { splitId: s.id, status: "untracked", lines: [], shortLines: 0 });
    }
    return out;
  }
  const primary = (warehouses.find((w) => w.is_primary) ?? warehouses[0])!.id;

  const pending = lines.filter((l) => l.status === "pending");
  const productIds = [...new Set(pending.map((l) => l.product_id))];

  const remaining = new Map<string, number>();
  const firstExpiry = new Map<string, string | null>();
  for (let i = 0; i < productIds.length; i += 200) {
    const chunk = productIds.slice(i, i + 200);
    const { data: lots } = (await (supabase as any)
      .from("stock_lots")
      .select("product_id, warehouse_id, quantity_base, quantity_reserved_base, expiry_date")
      .in("product_id", chunk)) as { data: Lot[] | null };
    for (const lot of lots ?? []) {
      const key = `${lot.product_id}|${lot.warehouse_id}`;
      const free = Math.max(Number(lot.quantity_base) - Number(lot.quantity_reserved_base), 0);
      remaining.set(key, (remaining.get(key) ?? 0) + free);
      if (free > 0 && lot.expiry_date) {
        const cur = firstExpiry.get(key);
        if (!cur || lot.expiry_date < cur) firstExpiry.set(key, lot.expiry_date);
      }
    }
  }

  const linesBySplit = new Map<string, CoverageLineInput[]>();
  for (const l of pending) {
    const arr = linesBySplit.get(l.order_split_id) ?? [];
    arr.push(l);
    linesBySplit.set(l.order_split_id, arr);
  }

  for (const s of splits) {
    const wh = s.warehouse_id ?? primary;
    const splitLines = (linesBySplit.get(s.id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    const cov: LineCoverage[] = [];
    let shortLines = 0;
    for (const l of splitLines) {
      const key = `${l.product_id}|${wh}`;
      const avail = remaining.get(key) ?? 0;
      const need = Number(l.quantity_requested);
      const short = Math.max(need - avail, 0);
      if (short > 0) shortLines++;
      cov.push({
        lineId: l.id,
        productId: l.product_id,
        requested: need,
        available: avail,
        short,
        firstExpiry: firstExpiry.get(key) ?? null,
      });
      remaining.set(key, Math.max(avail - need, 0));
    }
    const status: CoverageStatus =
      cov.length === 0
        ? "covered"
        : shortLines === 0
          ? "covered"
          : shortLines === cov.length
            ? "uncovered"
            : "partial";
    out.set(s.id, { splitId: s.id, status, lines: cov, shortLines });
  }
  return out;
}

export const COVERAGE_LABEL: Record<CoverageStatus, string> = {
  covered: "Stock coperto",
  partial: "Stock parziale",
  uncovered: "Stock scoperto",
  untracked: "Stock non gestito",
};

export const COVERAGE_TONE: Record<CoverageStatus, "success" | "warning" | "danger" | "neutral"> = {
  covered: "success",
  partial: "warning",
  uncovered: "danger",
  untracked: "neutral",
};
