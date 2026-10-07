/* eslint-disable @typescript-eslint/no-explicit-any */
// Osservatorio prezzi: price changes on what the restaurant actually buys and
// cheaper equivalent offers from its other suppliers. Real data only:
// marketplace price_history, catalog price memory (trigger) and the
// restaurant's own purchase volumes.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RestaurantContext } from "@/lib/restaurants/context";
import { loadOrderableOffers, loadPurchaseHistory } from "./server";
import { reorderStats } from "./predict.ts";
import { matchScore, productTokens } from "./text.ts";
import { normalizedUnitPrice, packSize, type Measure } from "./units.ts";
import type { Offer } from "./types";

export const PRICE_WINDOW_DAYS = 30;
const HISTORY_DAYS = 90;

export type PriceChange = {
  key: string;
  name: string;
  unit: string;
  supplierName: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  /** (new − old) × average monthly quantity bought. */
  monthlyImpact: number;
};

export type Alternative = {
  key: string;
  name: string;
  unit: string;
  supplierName: string;
  currentPrice: number;
  currentUnitPrice: number;
  measure: Measure;
  monthlyQty: number;
  alt: Offer;
  altUnitPrice: number;
  savingPct: number;
  monthlySaving: number;
};

export type PriceIntel = {
  increases: PriceChange[];
  decreases: PriceChange[];
  alternatives: Alternative[];
  potentialMonthlySaving: number;
  trackedItems: number;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function loadPriceIntel(ctx: Pick<RestaurantContext, "scopeIds">): Promise<PriceIntel> {
  const nowMs = Date.now();
  const since = new Date(nowMs - PRICE_WINDOW_DAYS * 86_400_000).toISOString();
  const catalog = await loadOrderableOffers(ctx.scopeIds);
  const history = await loadPurchaseHistory(ctx.scopeIds, HISTORY_DAYS, catalog);
  const offerByKey = new Map(catalog.offers.map((o) => [o.key, o]));
  const supabase = (await createClient()) as any;

  type Bought = { key: string; offer: Offer; monthlyQty: number };
  const bought: Bought[] = [];
  for (const h of history.items.values()) {
    const offer = offerByKey.get(h.key);
    const stats = reorderStats(h.events, nowMs, HISTORY_DAYS);
    if (!offer || !stats) continue;
    bought.push({ key: h.key, offer, monthlyQty: stats.monthlyQty });
  }

  /* ---------------- Price changes ---------------- */
  const changes: PriceChange[] = [];

  // Marketplace products: price_history rows are the successive list prices.
  const productIds = bought.filter((b) => b.offer.kind === "product").map((b) => b.offer.offerId);
  const byProduct = new Map<string, { price: number; at: string }[]>();
  for (const ids of chunk(productIds, 150)) {
    const { data } = await supabase
      .from("price_history")
      .select("product_id, price, recorded_at")
      .in("product_id", ids)
      .order("recorded_at", { ascending: true })
      .limit(5000);
    for (const r of (data ?? []) as { product_id: string; price: number | string; recorded_at: string }[]) {
      const arr = byProduct.get(r.product_id) ?? [];
      arr.push({ price: Number(r.price), at: r.recorded_at });
      byProduct.set(r.product_id, arr);
    }
  }
  for (const b of bought) {
    if (b.offer.kind !== "product") continue;
    const rows = byProduct.get(b.offer.offerId) ?? [];
    const before = rows.filter((r) => r.at < since);
    const inside = rows.filter((r) => r.at >= since);
    const baseline = before[before.length - 1]?.price;
    if (baseline === undefined || inside.length === 0) continue;
    const latest = b.offer.price;
    if (Math.abs(latest - baseline) < 0.005) continue;
    changes.push({
      key: b.key,
      name: b.offer.name,
      unit: b.offer.unit,
      supplierName: b.offer.supplierName,
      oldPrice: baseline,
      newPrice: latest,
      changedAt: inside[inside.length - 1]!.at,
      monthlyImpact: (latest - baseline) * b.monthlyQty,
    });
  }

  // Private catalogs: change log written by the price-memory trigger.
  const catalogKeys = new Map(bought.filter((b) => b.offer.kind === "catalog").map((b) => [b.key, b]));
  const catalogIds = [...new Set([...catalogKeys.values()].map((b) => b.offer.supplierKey))];
  if (catalogIds.length > 0) {
    const { data, error } = await supabase
      .from("restaurant_catalog_price_changes")
      .select("catalog_id, item_key, old_price, new_price, changed_at")
      .in("catalog_id", catalogIds)
      .gte("changed_at", since)
      .order("changed_at", { ascending: true })
      .limit(5000);
    if (!error) {
      const net = new Map<string, { old: number; new: number; at: string }>();
      for (const r of (data ?? []) as {
        catalog_id: string;
        item_key: string;
        old_price: number | string;
        new_price: number | string;
        changed_at: string;
      }[]) {
        const key = `c:${r.catalog_id}:${r.item_key}`;
        const cur = net.get(key);
        if (cur) {
          cur.new = Number(r.new_price);
          cur.at = r.changed_at;
        } else net.set(key, { old: Number(r.old_price), new: Number(r.new_price), at: r.changed_at });
      }
      for (const [key, n] of net) {
        const b = catalogKeys.get(key);
        if (!b || Math.abs(n.new - n.old) < 0.005) continue;
        changes.push({
          key,
          name: b.offer.name,
          unit: b.offer.unit,
          supplierName: b.offer.supplierName,
          oldPrice: n.old,
          newPrice: n.new,
          changedAt: n.at,
          monthlyImpact: (n.new - n.old) * b.monthlyQty,
        });
      }
    }
  }

  /* ---------------- Cheaper alternatives ---------------- */
  const tokensByKey = new Map<string, string[]>();
  const index = new Map<string, Offer[]>();
  for (const o of catalog.offers) {
    const toks = productTokens(o.packName);
    tokensByKey.set(o.key, toks);
    for (const t of new Set(toks)) {
      const arr = index.get(t);
      if (arr) arr.push(o);
      else index.set(t, [o]);
    }
  }

  const alternatives: Alternative[] = [];
  for (const b of bought) {
    const mine = normalizedUnitPrice(b.offer.packName, b.offer.unit, b.offer.price);
    const myPack = packSize(b.offer.packName, b.offer.unit);
    const myTokens = tokensByKey.get(b.key) ?? [];
    if (!mine || !myPack || myTokens.length === 0 || b.monthlyQty <= 0) continue;
    const pool = new Set<Offer>();
    for (const t of myTokens) for (const o of index.get(t) ?? []) pool.add(o);
    let best: { offer: Offer; unitPrice: number } | null = null;
    for (const o of pool) {
      if (o.supplierKey === b.offer.supplierKey) continue;
      const theirs = tokensByKey.get(o.key) ?? [];
      // Same product both ways (avoids "pomodoro" ↔ "pomodoro secco sott'olio").
      if (matchScore(myTokens, theirs) < 0.75 || matchScore(theirs, myTokens) < 0.75) continue;
      const np = normalizedUnitPrice(o.packName, o.unit, o.price);
      if (!np || np.measure !== mine.measure) continue;
      if (!best || np.price < best.unitPrice) best = { offer: o, unitPrice: np.price };
    }
    if (!best) continue;
    const savingPct = (mine.price - best.unitPrice) / mine.price;
    if (savingPct < 0.03) continue;
    const monthlySaving = (mine.price - best.unitPrice) * myPack.amount * b.monthlyQty;
    if (monthlySaving < 1) continue;
    alternatives.push({
      key: b.key,
      name: b.offer.name,
      unit: b.offer.unit,
      supplierName: b.offer.supplierName,
      currentPrice: b.offer.price,
      currentUnitPrice: mine.price,
      measure: mine.measure,
      monthlyQty: b.monthlyQty,
      alt: best.offer,
      altUnitPrice: best.unitPrice,
      savingPct,
      monthlySaving,
    });
  }
  alternatives.sort((a, b) => b.monthlySaving - a.monthlySaving);

  return {
    increases: changes.filter((c) => c.newPrice > c.oldPrice).sort((a, b) => b.monthlyImpact - a.monthlyImpact),
    decreases: changes.filter((c) => c.newPrice < c.oldPrice).sort((a, b) => a.monthlyImpact - b.monthlyImpact),
    alternatives,
    potentialMonthlySaving: alternatives.reduce((s, a) => s + a.monthlySaving, 0),
    trackedItems: bought.length,
  };
}
