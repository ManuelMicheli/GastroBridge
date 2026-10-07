/* eslint-disable @typescript-eslint/no-explicit-any */
// Credit control (fido) — per-client terms + estimated exposure.
//
// GastroBridge has no invoicing/payments model yet, so exposure is an
// honest approximation built only from real orders:
//   open value      = splits accepted but not delivered (confirmed → shipping)
//   + not yet due   = splits delivered within the payment term window
// It is labelled "esposizione stimata" everywhere in the UI.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkflowState } from "@/lib/orders/workflow-state";

export type CustomerTerms = {
  restaurantId: string;
  creditLimit: number | null;
  paymentTermsDays: number | null;
  creditHold: boolean;
  notes: string | null;
  updatedAt: string | null;
};

export type CreditSnapshot = {
  restaurantId: string;
  creditLimit: number | null;
  /** Effective terms: client override, else supplier default. */
  paymentTermsDays: number;
  creditHold: boolean;
  notes: string | null;
  openValue: number;
  deliveredNotDue: number;
  exposure: number;
  /** exposure / limit, null without a limit. */
  utilization: number | null;
  flag: "hold" | "over" | "near" | "ok" | "none";
};

const OPEN_WORKFLOW = new Set(["confirmed", "preparing", "packed", "shipping"]);

/**
 * Loads terms for the given restaurants. `available=false` when the
 * `supplier_customer_terms` table does not exist yet (migration not applied).
 */
export async function loadCustomerTerms(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  restaurantIds?: string[],
): Promise<{ available: boolean; terms: Map<string, CustomerTerms> }> {
  const terms = new Map<string, CustomerTerms>();
  let q = (supabase as any)
    .from("supplier_customer_terms")
    .select("restaurant_id, credit_limit_eur, payment_terms_days, credit_hold, notes, updated_at")
    .eq("supplier_id", supplierId);
  if (restaurantIds && restaurantIds.length > 0) q = q.in("restaurant_id", restaurantIds.slice(0, 500));
  const { data, error } = await q;
  if (error) return { available: false, terms };
  for (const r of (data ?? []) as Array<{
    restaurant_id: string;
    credit_limit_eur: number | null;
    payment_terms_days: number | null;
    credit_hold: boolean;
    notes: string | null;
    updated_at: string | null;
  }>) {
    terms.set(r.restaurant_id, {
      restaurantId: r.restaurant_id,
      creditLimit: r.credit_limit_eur === null ? null : Number(r.credit_limit_eur),
      paymentTermsDays: r.payment_terms_days,
      creditHold: !!r.credit_hold,
      notes: r.notes,
      updatedAt: r.updated_at,
    });
  }
  return { available: true, terms };
}

export type ExposureSplit = {
  restaurantId: string;
  status: string;
  supplierNotes: string | null;
  subtotal: number;
  deliveredAt: string | null;
};

/** Pure exposure computation, shared by every view. */
export function buildCreditSnapshots(
  restaurantIds: string[],
  splits: ExposureSplit[],
  terms: Map<string, CustomerTerms>,
  supplierDefaultTerms: number,
  now: Date = new Date(),
): Map<string, CreditSnapshot> {
  const out = new Map<string, CreditSnapshot>();
  for (const rid of restaurantIds) {
    const t = terms.get(rid);
    const termsDays = t?.paymentTermsDays ?? supplierDefaultTerms;
    out.set(rid, {
      restaurantId: rid,
      creditLimit: t?.creditLimit ?? null,
      paymentTermsDays: termsDays,
      creditHold: t?.creditHold ?? false,
      notes: t?.notes ?? null,
      openValue: 0,
      deliveredNotDue: 0,
      exposure: 0,
      utilization: null,
      flag: "none",
    });
  }
  for (const s of splits) {
    const snap = out.get(s.restaurantId);
    if (!snap) continue;
    const wf = getWorkflowState(s.status, s.supplierNotes);
    if (OPEN_WORKFLOW.has(wf)) {
      snap.openValue += Number(s.subtotal || 0);
    } else if (wf === "delivered" && s.deliveredAt) {
      const ageDays = (now.getTime() - new Date(s.deliveredAt).getTime()) / 86_400_000;
      if (ageDays <= snap.paymentTermsDays) snap.deliveredNotDue += Number(s.subtotal || 0);
    }
  }
  for (const snap of out.values()) {
    snap.exposure = Math.round((snap.openValue + snap.deliveredNotDue) * 100) / 100;
    if (snap.creditLimit !== null && snap.creditLimit > 0) {
      snap.utilization = snap.exposure / snap.creditLimit;
    }
    snap.flag = snap.creditHold
      ? "hold"
      : snap.utilization === null
        ? snap.creditLimit === 0
          ? "over"
          : "none"
        : snap.utilization >= 1
          ? "over"
          : snap.utilization >= 0.85
            ? "near"
            : "ok";
  }
  return out;
}

/**
 * Exposure for a set of clients, reading their splits of the last
 * max(terms)+? days plus every open split.
 */
export async function getCreditSnapshots(
  supabase: SupabaseClient<any, any, any>,
  supplierId: string,
  restaurantIds: string[],
): Promise<{ available: boolean; snapshots: Map<string, CreditSnapshot> }> {
  const ids = [...new Set(restaurantIds)].filter(Boolean);
  if (ids.length === 0) return { available: true, snapshots: new Map() };

  const [{ available, terms }, supplierRes] = await Promise.all([
    loadCustomerTerms(supabase, supplierId, ids),
    (supabase as any).from("suppliers").select("payment_terms_days").eq("id", supplierId).maybeSingle(),
  ]);
  const defaultTerms = Number(supplierRes?.data?.payment_terms_days ?? 30) || 30;
  const maxTerms = Math.max(
    defaultTerms,
    ...[...terms.values()].map((t) => t.paymentTermsDays ?? 0),
  );
  const since = new Date(Date.now() - (maxTerms + 120) * 86_400_000).toISOString();

  const splits: ExposureSplit[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data } = (await (supabase as any)
      .from("order_splits")
      .select("status, supplier_notes, subtotal, delivered_at, orders!inner(restaurant_id, created_at)")
      .eq("supplier_id", supplierId)
      .in("status", ["confirmed", "preparing", "shipping", "delivered"])
      .in("orders.restaurant_id", chunk)
      .gte("orders.created_at", since)) as {
      data: Array<{
        status: string;
        supplier_notes: string | null;
        subtotal: number;
        delivered_at: string | null;
        orders: { restaurant_id: string } | null;
      }> | null;
    };
    for (const r of data ?? []) {
      if (!r.orders) continue;
      splits.push({
        restaurantId: r.orders.restaurant_id,
        status: r.status,
        supplierNotes: r.supplier_notes,
        subtotal: Number(r.subtotal || 0),
        deliveredAt: r.delivered_at,
      });
    }
  }

  return { available, snapshots: buildCreditSnapshots(ids, splits, terms, defaultTerms) };
}

export const CREDIT_FLAG_LABEL: Record<CreditSnapshot["flag"], string> = {
  hold: "Cliente bloccato",
  over: "Fido superato",
  near: "Vicino al fido",
  ok: "Entro il fido",
  none: "Nessun fido",
};
