// Customer ordering cadence + product intelligence. Pure functions (no
// imports) so they are unit-testable with `node --test`.

export type ClientOrder = {
  restaurantId: string;
  /** ISO timestamp of the order. */
  createdAt: string;
  subtotal: number;
};

export type CadenceStatus = "regolare" | "in_ritardo" | "a_rischio" | "dormiente" | "nuovo";

export type ClientCadence = {
  restaurantId: string;
  ordersCount: number;
  lastOrderAt: string | null;
  daysSinceLast: number | null;
  /** Median days between consecutive orders (needs ≥ 3 orders). */
  cadenceDays: number | null;
  expectedNextAt: string | null;
  /** Days past the expected next order (0 when not late). */
  daysLate: number;
  revenueLast90: number;
  revenuePrev90: number;
  /** (last90 - prev90) / prev90, null when prev90 is 0. */
  revenueTrend: number | null;
  status: CadenceStatus;
  /** Higher = call first. Combines lateness with the client's value. */
  riskScore: number;
};

const DAY = 86_400_000;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Cadence per client. Orders on the same calendar day count once (a
 * restaurant often sends a second "dimenticanza" order the same morning).
 */
export function computeCadence(
  restaurantIds: string[],
  orders: ClientOrder[],
  now: Date = new Date(),
): Map<string, ClientCadence> {
  const byClient = new Map<string, ClientOrder[]>();
  for (const o of orders) {
    const arr = byClient.get(o.restaurantId) ?? [];
    arr.push(o);
    byClient.set(o.restaurantId, arr);
  }

  const out = new Map<string, ClientCadence>();
  const nowMs = now.getTime();
  for (const rid of restaurantIds) {
    const list = (byClient.get(rid) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const days = [...new Set(list.map((o) => o.createdAt.slice(0, 10)))];
    const dayMs = days.map((d) => Date.parse(`${d}T12:00:00Z`));
    const gaps: number[] = [];
    for (let i = 1; i < dayMs.length; i++) gaps.push((dayMs[i]! - dayMs[i - 1]!) / DAY);

    const last = list.length > 0 ? list[list.length - 1]!.createdAt : null;
    const daysSinceLast = last ? Math.floor((nowMs - Date.parse(last)) / DAY) : null;
    const cadenceDays = days.length >= 3 ? Math.max(1, Math.round(median(gaps) * 10) / 10) : null;
    const expectedNextAt =
      last && cadenceDays !== null ? new Date(Date.parse(last) + cadenceDays * DAY).toISOString() : null;
    const daysLate =
      expectedNextAt !== null ? Math.max(0, Math.floor((nowMs - Date.parse(expectedNextAt)) / DAY)) : 0;

    let revenueLast90 = 0;
    let revenuePrev90 = 0;
    for (const o of list) {
      const age = (nowMs - Date.parse(o.createdAt)) / DAY;
      if (age <= 90) revenueLast90 += o.subtotal;
      else if (age <= 180) revenuePrev90 += o.subtotal;
    }
    const revenueTrend = revenuePrev90 > 0 ? (revenueLast90 - revenuePrev90) / revenuePrev90 : null;

    let status: CadenceStatus;
    if (daysSinceLast !== null && daysSinceLast > 60) status = "dormiente";
    else if (cadenceDays === null) status = "nuovo";
    else if (
      (daysSinceLast ?? 0) > cadenceDays * 2.5 ||
      (revenueTrend !== null && revenueTrend <= -0.4 && (daysSinceLast ?? 0) > cadenceDays)
    )
      status = "a_rischio";
    else if ((daysSinceLast ?? 0) > cadenceDays * 1.5) status = "in_ritardo";
    else status = "regolare";

    const value = Math.max(revenueLast90, revenuePrev90);
    const lateness =
      cadenceDays !== null && daysSinceLast !== null ? Math.max(0, daysSinceLast / cadenceDays - 1) : 0;
    const statusWeight =
      status === "a_rischio" ? 3 : status === "in_ritardo" ? 2 : status === "dormiente" ? 1 : 0;
    const riskScore = statusWeight === 0 ? 0 : statusWeight * (1 + lateness) * Math.log10(10 + value);

    out.set(rid, {
      restaurantId: rid,
      ordersCount: days.length,
      lastOrderAt: last,
      daysSinceLast,
      cadenceDays,
      expectedNextAt,
      daysLate,
      revenueLast90: Math.round(revenueLast90 * 100) / 100,
      revenuePrev90: Math.round(revenuePrev90 * 100) / 100,
      revenueTrend,
      status,
      riskScore: Math.round(riskScore * 100) / 100,
    });
  }
  return out;
}

export type ClientProductLine = {
  restaurantId: string;
  productId: string;
  /** ISO timestamp of the order. */
  orderedAt: string;
  quantity: number;
};

export type FallOffProduct = {
  productId: string;
  ordersInWindow: number;
  lastOrderedAt: string;
};

/**
 * Products the client bought regularly (≥ 2 distinct orders between 45 and
 * 135 days ago) and has not ordered in the last 45 days.
 */
export function fallOffProducts(
  restaurantId: string,
  lines: ClientProductLine[],
  now: Date = new Date(),
): FallOffProduct[] {
  const nowMs = now.getTime();
  const recent = new Set<string>();
  const before = new Map<string, { orders: Set<string>; last: string }>();
  for (const l of lines) {
    if (l.restaurantId !== restaurantId) continue;
    const age = (nowMs - Date.parse(l.orderedAt)) / DAY;
    if (age <= 45) {
      recent.add(l.productId);
    } else if (age <= 135) {
      const e = before.get(l.productId) ?? { orders: new Set<string>(), last: l.orderedAt };
      e.orders.add(l.orderedAt.slice(0, 10));
      if (l.orderedAt > e.last) e.last = l.orderedAt;
      before.set(l.productId, e);
    }
  }
  return [...before.entries()]
    .filter(([pid, e]) => !recent.has(pid) && e.orders.size >= 2)
    .map(([productId, e]) => ({ productId, ordersInWindow: e.orders.size, lastOrderedAt: e.last }))
    .sort((a, b) => b.ordersInWindow - a.ordersInWindow);
}

export type Suggestion = {
  productId: string;
  /** How many similar clients buy it. */
  similarClients: number;
  /** Sum of the Jaccard similarity of those clients (ranking weight). */
  score: number;
};

/**
 * "Clients like this one also buy…": clients sharing ≥ 2 products with the
 * target (Jaccard similarity on product sets), products they buy that the
 * target never bought. Real co-purchase data only — returns [] when no
 * similar client exists.
 */
export function similarClientSuggestions(
  restaurantId: string,
  lines: ClientProductLine[],
  { maxNeighbours = 15, limit = 8 }: { maxNeighbours?: number; limit?: number } = {},
): Suggestion[] {
  const sets = new Map<string, Set<string>>();
  for (const l of lines) {
    const s = sets.get(l.restaurantId) ?? new Set<string>();
    s.add(l.productId);
    sets.set(l.restaurantId, s);
  }
  const target = sets.get(restaurantId);
  if (!target || target.size === 0) return [];

  const neighbours: Array<{ id: string; sim: number; set: Set<string> }> = [];
  for (const [rid, set] of sets) {
    if (rid === restaurantId) continue;
    let shared = 0;
    for (const p of set) if (target.has(p)) shared++;
    if (shared < 2) continue;
    const union = target.size + set.size - shared;
    neighbours.push({ id: rid, sim: shared / union, set });
  }
  neighbours.sort((a, b) => b.sim - a.sim);

  const agg = new Map<string, Suggestion>();
  for (const n of neighbours.slice(0, maxNeighbours)) {
    for (const p of n.set) {
      if (target.has(p)) continue;
      const e = agg.get(p) ?? { productId: p, similarClients: 0, score: 0 };
      e.similarClients++;
      e.score += n.sim;
      agg.set(p, e);
    }
  }
  return [...agg.values()]
    .sort((a, b) => b.score - a.score || b.similarClients - a.similarClients)
    .slice(0, limit)
    .map((s) => ({ ...s, score: Math.round(s.score * 1000) / 1000 }));
}

export const CADENCE_LABEL: Record<CadenceStatus, string> = {
  regolare: "Regolare",
  in_ritardo: "In ritardo",
  a_rischio: "A rischio",
  dormiente: "Dormiente",
  nuovo: "Nuovo / pochi ordini",
};

export const CADENCE_TONE: Record<CadenceStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  regolare: "success",
  in_ritardo: "warning",
  a_rischio: "danger",
  dormiente: "neutral",
  nuovo: "info",
};
