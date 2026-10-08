// "Riordino rapido" order guide: per supplier, the items the restaurant buys
// with explainable suggested quantities, cut-off and minimum order.

import "server-only";
import type { RestaurantContext } from "@/lib/restaurants/context";
import { loadOrderableOffers, loadParLevels, loadPurchaseHistory, loadSchedules } from "./server";
import { reorderStats, type ReorderStats } from "./predict.ts";
import { nextDeadline } from "./schedule.ts";
import type { Offer, ScheduleInfo } from "./types";

export const GUIDE_HISTORY_DAYS = 180;

export type GuideLine = {
  key: string;
  name: string;
  unit: string;
  /** Current offer (null when no longer in the supplier list). */
  offer: Offer | null;
  stats: ReorderStats | null;
  par: number | null;
};

export type GuideSupplier = {
  key: string;
  kind: "product" | "catalog";
  name: string;
  minOrderAmount: number | null;
  schedule: ScheduleInfo | null;
  /** Next order deadline (epoch ms) and its delivery date. */
  deadlineMs: number | null;
  deliveryDate: string | null;
  lastOrderAt: string | null;
  lines: GuideLine[];
  dueCount: number;
};

export type OrderGuide = {
  suppliers: GuideSupplier[];
  offers: Offer[];
  nowMs: number;
};

export async function buildOrderGuide(
  ctx: Pick<RestaurantContext, "restaurantId" | "scopeIds">,
): Promise<OrderGuide> {
  const nowMs = Date.now();
  const catalog = await loadOrderableOffers(ctx.scopeIds);
  const [history, schedules, pars] = await Promise.all([
    loadPurchaseHistory(ctx.scopeIds, GUIDE_HISTORY_DAYS, catalog),
    loadSchedules(ctx, catalog.suppliers),
    loadParLevels(ctx.restaurantId),
  ]);

  const offerByKey = new Map(catalog.offers.map((o) => [o.key, o]));
  const bySupplier = new Map<string, GuideLine[]>();
  const add = (supplierKey: string, line: GuideLine) => {
    const arr = bySupplier.get(supplierKey);
    if (arr) arr.push(line);
    else bySupplier.set(supplierKey, [line]);
  };

  const used = new Set<string>();
  for (const h of history.items.values()) {
    const offer = offerByKey.get(h.key) ?? null;
    used.add(h.key);
    add(offer?.supplierKey ?? h.supplierKey, {
      key: h.key,
      name: offer?.name ?? h.name,
      unit: offer?.unit ?? h.unit,
      offer,
      stats: reorderStats(h.events, nowMs, GUIDE_HISTORY_DAYS),
      par: pars.get(h.key) ?? null,
    });
  }
  // Items with a par level but never ordered in the window.
  for (const [key, par] of pars) {
    if (used.has(key)) continue;
    const offer = offerByKey.get(key);
    if (!offer) continue;
    add(offer.supplierKey, { key, name: offer.name, unit: offer.unit, offer, stats: null, par });
  }

  const suppliers: GuideSupplier[] = [];
  for (const s of catalog.suppliers) {
    const lines = bySupplier.get(s.key) ?? [];
    const schedule = schedules.get(s.key) ?? null;
    const next = schedule ? nextDeadline(schedule, nowMs) : null;
    lines.sort((a, b) => {
      const ad = a.stats?.due ? 1 : 0;
      const bd = b.stats?.due ? 1 : 0;
      if (ad !== bd) return bd - ad;
      const at = a.stats?.timesOrdered ?? 0;
      const bt = b.stats?.timesOrdered ?? 0;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name, "it");
    });
    suppliers.push({
      key: s.key,
      kind: s.kind,
      name: s.name,
      minOrderAmount: s.minOrderAmount,
      schedule,
      deadlineMs: next?.deadlineMs ?? null,
      deliveryDate: next?.deliveryDate ?? null,
      lastOrderAt: history.lastOrderAtBySupplier.get(s.key) ?? null,
      lines,
      dueCount: lines.filter((l) => l.offer && l.stats?.due).length,
    });
  }

  // Suppliers with history first, nearest deadline first, then by name.
  suppliers.sort((a, b) => {
    const ah = a.lines.length > 0 ? 1 : 0;
    const bh = b.lines.length > 0 ? 1 : 0;
    if (ah !== bh) return bh - ah;
    const ad = a.deadlineMs ?? Number.POSITIVE_INFINITY;
    const bd = b.deadlineMs ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name, "it");
  });

  return { suppliers, offers: catalog.offers, nowMs };
}
