// Data for free-text ordering (Ordine veloce, Lista cucina): orderable offers +
// how often each was ordered (the matcher prefers what the kitchen already buys).

import "server-only";
import type { RestaurantContext } from "@/lib/restaurants/context";
import { loadOrderableOffers, loadPurchaseHistory } from "./server";
import type { Offer } from "./types";

export type QuickOrderData = {
  offers: Offer[];
  timesOrdered: Record<string, number>;
};

export async function loadQuickOrderData(ctx: Pick<RestaurantContext, "scopeIds">): Promise<QuickOrderData> {
  const catalog = await loadOrderableOffers(ctx.scopeIds);
  const history = await loadPurchaseHistory(ctx.scopeIds, 180, catalog);
  const timesOrdered: Record<string, number> = {};
  for (const h of history.items.values()) {
    timesOrdered[h.key] = new Set(h.events.map((e) => e.at.slice(0, 10))).size;
  }
  return { offers: catalog.offers, timesOrdered };
}
