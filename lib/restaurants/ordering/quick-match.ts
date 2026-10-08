// Match parsed shopping-list lines to orderable offers. Pure module.

import { MATCH_THRESHOLD, matchScore, normalizeUnit, productTokens } from "./text.ts";
import { normalizedUnitPrice, packSize } from "./units.ts";
import type { ParsedLine } from "./quick-parse.ts";

export type MatchableOffer = {
  key: string;
  name: string;
  unit: string;
  price: number;
  supplierKey: string;
  supplierName: string;
  /** How many times the restaurant ordered this exact offer (history). */
  timesOrdered: number;
  tokens: string[];
};

export type LineMatch = {
  offer: MatchableOffer;
  score: number;
  qty: number;
  /** Set when the written unit could not be converted to the offer's unit. */
  unitNote: string | null;
};

const WEIGHT_TO_KG: Record<string, number> = { kg: 1, g: 0.001, hg: 0.1 };
const VOLUME_TO_L: Record<string, number> = { l: 1, ml: 0.001, cl: 0.01 };

/** Quantity of `offer` units for what the cook wrote. */
export function convertQty(line: Pick<ParsedLine, "qty" | "unit">, offer: Pick<MatchableOffer, "name" | "unit">): {
  qty: number;
  unitNote: string | null;
} {
  const offerUnit = normalizeUnit(offer.unit);
  if (!line.unit || line.unit === offerUnit) return { qty: line.qty, unitNote: null };

  const pack = packSize(offer.name, offer.unit);
  const kg = WEIGHT_TO_KG[line.unit];
  const l = VOLUME_TO_L[line.unit];
  const wanted = kg !== undefined ? { measure: "kg", amount: line.qty * kg } : l !== undefined ? { measure: "l", amount: line.qty * l } : null;
  if (wanted && pack && pack.measure === wanted.measure && pack.amount > 0) {
    const raw = wanted.amount / pack.amount;
    const fractional = offerUnit === "kg" || offerUnit === "l" || offerUnit === "g" || offerUnit === "hg";
    const qty = fractional ? Math.max(0.01, Math.round(raw * 100) / 100) : Math.max(1, Math.ceil(raw - 1e-9));
    return { qty, unitNote: null };
  }
  return {
    qty: line.qty,
    unitNote: `Hai scritto “${line.unit}”, il fornitore vende a ${offer.unit}`,
  };
}

/** Prepare offers once (tokenization is the expensive part). */
export function toMatchable<T extends Omit<MatchableOffer, "tokens">>(offers: T[]): (T & { tokens: string[] })[] {
  return offers.map((o) => ({ ...o, tokens: productTokens(o.name) }));
}

/**
 * Best offer + alternatives for one line. Among offers that match about as
 * well as the best one, the one already bought wins, then the lowest
 * normalized price (€/kg, €/l, €/pz).
 */
export function matchLine(
  line: Pick<ParsedLine, "text" | "qty" | "unit">,
  offers: MatchableOffer[],
  maxAlternatives = 6,
): { best: LineMatch | null; candidates: LineMatch[] } {
  const q = productTokens(line.text);
  if (q.length === 0) return { best: null, candidates: [] };

  const scored: { offer: MatchableOffer; score: number }[] = [];
  for (const o of offers) {
    const s = matchScore(q, o.tokens);
    if (s >= MATCH_THRESHOLD) scored.push({ offer: o, score: s });
  }
  if (scored.length === 0) return { best: null, candidates: [] };

  const top = Math.max(...scored.map((s) => s.score));
  const unitPrice = (o: MatchableOffer) => normalizedUnitPrice(o.name, o.unit, o.price)?.price ?? o.price;
  scored.sort((a, b) => {
    const aNear = a.score >= top - 0.1 ? 1 : 0;
    const bNear = b.score >= top - 0.1 ? 1 : 0;
    if (aNear !== bNear) return bNear - aNear;
    if (aNear && a.offer.timesOrdered !== b.offer.timesOrdered) return b.offer.timesOrdered - a.offer.timesOrdered;
    if (Math.abs(a.score - b.score) > 0.1) return b.score - a.score;
    return unitPrice(a.offer) - unitPrice(b.offer);
  });

  const candidates = scored.slice(0, maxAlternatives + 1).map(({ offer, score }) => {
    const { qty, unitNote } = convertQty(line, offer);
    return { offer, score, qty, unitNote };
  });
  return { best: candidates[0] ?? null, candidates };
}
