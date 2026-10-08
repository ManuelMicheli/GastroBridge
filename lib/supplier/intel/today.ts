/* eslint-disable @typescript-eslint/no-explicit-any */
// "Oggi" command center data (server-only). One loader, sections filtered by
// the member's permissions so a role never receives data it may not see.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowState } from "@/lib/orders/workflow-state";
import { hasPermission } from "@/lib/supplier/permissions";
import type { CurrentSupplierMember } from "@/lib/supplier/current-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeStockCoverage, type CoverageStatus } from "./coverage";
import { getCreditSnapshots, type CreditSnapshot } from "./credit";
import { addDaysKey, daysBetweenKeys, nextCutoffs, todayKey, type NextCutoff } from "./time";
import { getCustomerInsights, type CustomerInsightRow } from "./customers";

export type PendingOrder = {
  splitId: string;
  restaurantId: string;
  restaurantName: string;
  subtotal: number;
  createdAt: string;
  ageHours: number;
  expectedDeliveryDate: string | null;
  lineCount: number;
  coverage: CoverageStatus;
  shortLines: number;
  credit: Pick<CreditSnapshot, "flag" | "exposure" | "creditLimit"> | null;
};

export type PrepOrder = {
  splitId: string;
  restaurantName: string;
  expectedDeliveryDate: string | null;
  workflow: string;
  lineCount: number;
  subtotal: number;
};

export type DeliveryProgress = {
  date: string;
  planned: number;
  loaded: number;
  inTransit: number;
  delivered: number;
  failed: number;
  total: number;
  onlyMine: boolean;
};

export type Issue = {
  key: string;
  kind: "stock_conflict" | "awaiting_customer" | "delivery_failed" | "overdue";
  title: string;
  detail: string;
  href: string;
};

export type ReorderRow = {
  productId: string;
  name: string;
  available: number;
  threshold: number;
  openDemand: number;
  suggested: number;
};

export type ExpiringLot = {
  lotId: string;
  productName: string;
  lotCode: string;
  expiryDate: string;
  daysLeft: number;
  quantity: number;
};

export type TodayBoard = {
  today: string;
  role: CurrentSupplierMember["role"];
  can: {
    accept: boolean;
    prepare: boolean;
    deliveries: boolean;
    planDeliveries: boolean;
    stock: boolean;
    financial: boolean;
  };
  cutoffs: NextCutoff[];
  pending: PendingOrder[];
  prep: PrepOrder[];
  deliveries: DeliveryProgress | null;
  issues: Issue[];
  reorder: ReorderRow[];
  expiring: ExpiringLot[];
  atRisk: CustomerInsightRow[];
};

type SplitRaw = {
  id: string;
  status: string;
  supplier_notes: string | null;
  subtotal: number;
  warehouse_id: string | null;
  expected_delivery_date: string | null;
  orders: {
    created_at: string;
    restaurant_id: string;
    restaurants: { name: string } | null;
  } | null;
};

export async function getTodayBoard(
  supabase: SupabaseClient<any, any, any>,
  member: CurrentSupplierMember,
): Promise<TodayBoard> {
  const supplierId = member.supplier_id;
  const role = member.role;
  const can = {
    accept: hasPermission(role, "order.accept_line"),
    prepare: hasPermission(role, "order.prepare"),
    deliveries: hasPermission(role, "delivery.execute") || hasPermission(role, "delivery.plan"),
    planDeliveries: hasPermission(role, "delivery.plan"),
    stock: hasPermission(role, "stock.read"),
    financial: hasPermission(role, "analytics.financial"),
  };
  const today = todayKey();
  const now = Date.now();

  // ---- Active splits (all roles read order_splits; we only expose what the
  //      role needs below).
  const { data: splitRows } = (await (supabase as any)
    .from("order_splits")
    .select(
      "id, status, supplier_notes, subtotal, warehouse_id, expected_delivery_date, orders:order_id ( created_at, restaurant_id, restaurants:restaurant_id ( name ) )",
    )
    .eq("supplier_id", supplierId)
    .in("status", ["submitted", "confirmed", "preparing", "shipping"])
    .limit(1000)) as { data: SplitRaw[] | null };
  const splits = (splitRows ?? []).map((s) => ({ ...s, workflow: getWorkflowState(s.status, s.supplier_notes) }));

  const pendingSplits = splits
    .filter((s) => s.workflow === "submitted")
    .sort((a, b) => (a.orders?.created_at ?? "").localeCompare(b.orders?.created_at ?? ""));
  const prepSplits = splits.filter((s) => ["confirmed", "preparing", "packed"].includes(s.workflow));

  // Lines of the pending + prep splits (counts + coverage).
  const lineSplitIds = [...pendingSplits, ...prepSplits].map((s) => s.id);
  const lines: Array<{ id: string; order_split_id: string; product_id: string; quantity_requested: number; status: string }> = [];
  for (let i = 0; i < lineSplitIds.length; i += 200) {
    const { data } = await (supabase as any)
      .from("order_split_items")
      .select("id, order_split_id, product_id, quantity_requested, status")
      .in("order_split_id", lineSplitIds.slice(i, i + 200));
    lines.push(...((data ?? []) as typeof lines));
  }
  const lineCount = new Map<string, number>();
  for (const l of lines) lineCount.set(l.order_split_id, (lineCount.get(l.order_split_id) ?? 0) + 1);

  // ---- Pending (accept permission only)
  let pending: PendingOrder[] = [];
  if (can.accept && pendingSplits.length > 0) {
    const coverage = await computeStockCoverage(
      supabase,
      supplierId,
      pendingSplits.map((s) => ({ id: s.id, warehouse_id: s.warehouse_id })),
      lines,
    );
    const credit = await getCreditSnapshots(
      supabase,
      supplierId,
      pendingSplits.map((s) => s.orders?.restaurant_id ?? ""),
    );
    pending = pendingSplits.map((s) => {
      const cov = coverage.get(s.id);
      const rid = s.orders?.restaurant_id ?? "";
      const snap = credit.snapshots.get(rid);
      return {
        splitId: s.id,
        restaurantId: rid,
        restaurantName: s.orders?.restaurants?.name ?? "Cliente",
        subtotal: Number(s.subtotal || 0),
        createdAt: s.orders?.created_at ?? "",
        ageHours: s.orders?.created_at ? Math.max(0, (now - Date.parse(s.orders.created_at)) / 3_600_000) : 0,
        expectedDeliveryDate: s.expected_delivery_date,
        lineCount: lineCount.get(s.id) ?? 0,
        coverage: cov?.status ?? "untracked",
        shortLines: cov?.shortLines ?? 0,
        credit: snap && snap.flag !== "none" && snap.flag !== "ok"
          ? { flag: snap.flag, exposure: snap.exposure, creditLimit: snap.creditLimit }
          : null,
      };
    });
  }

  // ---- Prep queue (prepare permission)
  const prep: PrepOrder[] = can.prepare
    ? prepSplits
        .map((s) => ({
          splitId: s.id,
          restaurantName: s.orders?.restaurants?.name ?? "Cliente",
          expectedDeliveryDate: s.expected_delivery_date,
          workflow: s.workflow,
          lineCount: lineCount.get(s.id) ?? 0,
          subtotal: Number(s.subtotal || 0),
        }))
        .sort((a, b) => (a.expectedDeliveryDate ?? "9999").localeCompare(b.expectedDeliveryDate ?? "9999"))
    : [];

  // ---- Deliveries today (driver: only own)
  let deliveries: DeliveryProgress | null = null;
  const onlyMine = !can.planDeliveries && role === "driver";
  if (can.deliveries) {
    let q = (supabase as any)
      .from("deliveries")
      .select("id, status, driver_member_id, order_splits:order_split_id ( supplier_id )")
      .eq("scheduled_date", today);
    if (onlyMine) q = q.eq("driver_member_id", member.id);
    const { data } = (await q) as {
      data: Array<{ id: string; status: string; order_splits: { supplier_id: string } | null }> | null;
    };
    const rows = (data ?? []).filter((d) => d.order_splits?.supplier_id === supplierId);
    deliveries = {
      date: today,
      planned: rows.filter((d) => d.status === "planned").length,
      loaded: rows.filter((d) => d.status === "loaded").length,
      inTransit: rows.filter((d) => d.status === "in_transit").length,
      delivered: rows.filter((d) => d.status === "delivered").length,
      failed: rows.filter((d) => d.status === "failed").length,
      total: rows.length,
      onlyMine,
    };
  }

  // ---- Issues
  const issues: Issue[] = [];
  if (can.accept || can.prepare) {
    for (const s of splits) {
      const name = s.orders?.restaurants?.name ?? "Cliente";
      if (s.workflow === "stock_conflict" && can.accept) {
        issues.push({
          key: `sc-${s.id}`,
          kind: "stock_conflict",
          title: `Conflitto stock — ${name}`,
          detail: "Lo stock non bastava per confermare: modifica le righe o carica merce.",
          href: `/supplier/ordini/${s.id}`,
        });
      }
      if (s.workflow === "pending_customer_confirmation" && can.accept) {
        issues.push({
          key: `pc-${s.id}`,
          kind: "awaiting_customer",
          title: `In attesa del cliente — ${name}`,
          detail: "Hai proposto modifiche: sollecita la conferma in chat o al telefono.",
          href: `/supplier/ordini/${s.id}`,
        });
      }
      if (
        s.expected_delivery_date &&
        s.expected_delivery_date < today &&
        ["confirmed", "preparing", "packed", "submitted"].includes(s.workflow)
      ) {
        issues.push({
          key: `od-${s.id}`,
          kind: "overdue",
          title: `Consegna prevista superata — ${name}`,
          detail: `Era prevista ${daysBetweenKeys(s.expected_delivery_date, today)} gg fa e l'ordine non è ancora partito.`,
          href: `/supplier/ordini/${s.id}`,
        });
      }
    }
  }
  if (can.deliveries) {
    let q = (supabase as any)
      .from("deliveries")
      .select("id, failure_reason, scheduled_date, driver_member_id, order_splits:order_split_id ( supplier_id, orders:order_id ( restaurants:restaurant_id ( name ) ) )")
      .eq("status", "failed")
      .gte("scheduled_date", addDaysKey(today, -3));
    if (onlyMine) q = q.eq("driver_member_id", member.id);
    const { data } = (await q) as {
      data: Array<{
        id: string;
        failure_reason: string | null;
        scheduled_date: string;
        order_splits: { supplier_id: string; orders: { restaurants: { name: string } | null } | null } | null;
      }> | null;
    };
    for (const d of data ?? []) {
      if (d.order_splits?.supplier_id !== supplierId) continue;
      issues.push({
        key: `df-${d.id}`,
        kind: "delivery_failed",
        title: `Consegna fallita — ${d.order_splits?.orders?.restaurants?.name ?? "Cliente"}`,
        detail: d.failure_reason ? `Motivo: ${d.failure_reason}` : "Da ripianificare.",
        href: `/supplier/consegne/${d.id}`,
      });
    }
  }

  // ---- Stock: reorder points + expiring lots (stock.read)
  let reorder: ReorderRow[] = [];
  let expiring: ExpiringLot[] = [];
  if (can.stock) {
    const { data: products } = (await (supabase as any)
      .from("products")
      .select("id, name, low_stock_threshold")
      .eq("supplier_id", supplierId)
      .not("low_stock_threshold", "is", null)) as {
      data: Array<{ id: string; name: string; low_stock_threshold: number | null }> | null;
    };
    const tracked = products ?? [];
    if (tracked.length > 0) {
      const available = new Map<string, number>();
      for (let i = 0; i < tracked.length; i += 200) {
        const { data: lots } = (await (supabase as any)
          .from("stock_lots")
          .select("product_id, quantity_base, quantity_reserved_base")
          .in("product_id", tracked.slice(i, i + 200).map((p) => p.id))) as {
          data: Array<{ product_id: string; quantity_base: number; quantity_reserved_base: number }> | null;
        };
        for (const l of lots ?? []) {
          available.set(
            l.product_id,
            (available.get(l.product_id) ?? 0) + Math.max(Number(l.quantity_base) - Number(l.quantity_reserved_base), 0),
          );
        }
      }
      // Open demand = pending lines not yet reserved (same units as reserve_split_tx).
      const demand = new Map<string, number>();
      const pendingIds = new Set(pendingSplits.map((s) => s.id));
      for (const l of lines) {
        if (!pendingIds.has(l.order_split_id) || l.status !== "pending") continue;
        demand.set(l.product_id, (demand.get(l.product_id) ?? 0) + Number(l.quantity_requested));
      }
      reorder = tracked
        .map((p) => {
          const avail = available.get(p.id) ?? 0;
          const threshold = Number(p.low_stock_threshold ?? 0);
          const open = demand.get(p.id) ?? 0;
          const suggested = Math.max(0, Math.ceil(threshold + open - avail));
          return { productId: p.id, name: p.name, available: avail, threshold, openDemand: open, suggested };
        })
        .filter((r) => r.available - r.openDemand < r.threshold)
        .sort((a, b) => b.suggested - a.suggested)
        .slice(0, 12);
    }

    try {
      // mv_stock_at_risk has no RLS: read with the service role, scoped to
      // this supplier (membership + stock.read verified above).
      const admin = createAdminClient();
      const { data } = (await (admin as any)
        .from("mv_stock_at_risk")
        .select("lot_id, product_id, lot_code, expiry_date, days_to_expiry, quantity_base")
        .eq("supplier_id", supplierId)
        .lte("days_to_expiry", 3)
        .order("days_to_expiry", { ascending: true })
        .limit(12)) as {
        data: Array<{
          lot_id: string;
          product_id: string;
          lot_code: string | null;
          expiry_date: string;
          days_to_expiry: number;
          quantity_base: number | null;
        }> | null;
      };
      const lotRows = data ?? [];
      const names = new Map<string, string>();
      const pids = [...new Set(lotRows.map((r) => r.product_id))];
      if (pids.length > 0) {
        const { data: prods } = (await (supabase as any)
          .from("products")
          .select("id, name")
          .in("id", pids)) as { data: Array<{ id: string; name: string }> | null };
        for (const p of prods ?? []) names.set(p.id, p.name);
      }
      expiring = lotRows.map((r) => ({
        lotId: r.lot_id,
        productName: names.get(r.product_id) ?? "Prodotto",
        lotCode: r.lot_code ?? "",
        expiryDate: r.expiry_date,
        daysLeft: Number(r.days_to_expiry),
        quantity: Number(r.quantity_base ?? 0),
      }));
    } catch {
      expiring = [];
    }
  }

  // ---- Cut-offs (everyone who works orders)
  const { data: zones } = (await (supabase as any)
    .from("delivery_zones")
    .select("id, zone_name, cutoff_time, delivery_days")
    .eq("supplier_id", supplierId)) as {
    data: Array<{ id: string; zone_name: string | null; cutoff_time: string | null; delivery_days: number[] | null }> | null;
  };
  const cutoffs = nextCutoffs(zones ?? []);

  // ---- At-risk clients (financial roles)
  let atRisk: CustomerInsightRow[] = [];
  if (can.financial) {
    try {
      const insights = await getCustomerInsights(supabase, supplierId);
      atRisk = insights.rows.filter((r) => r.status === "a_rischio" || r.status === "in_ritardo").slice(0, 5);
    } catch {
      atRisk = [];
    }
  }

  return { today, role, can, cutoffs, pending, prep, deliveries, issues, reorder, expiring, atRisk };
}
