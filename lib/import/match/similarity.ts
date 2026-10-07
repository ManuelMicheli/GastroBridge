// String similarity for fuzzy product / supplier matching.

import { nameKey } from "../text.ts";

function trigrams(s: string): Map<string, number> {
  const t = `  ${s} `;
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice coefficient on character trigrams (0–1). */
export function trigramSimilarity(a: string, b: string): number {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const ta = trigrams(ka);
  const tb = trigrams(kb);
  let inter = 0;
  let total = 0;
  for (const [g, n] of ta) {
    total += n;
    const o = tb.get(g);
    if (o) inter += Math.min(n, o);
  }
  for (const n of tb.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

const STOP = new Set(["di", "da", "del", "della", "dei", "delle", "al", "alla", "e", "con", "in", "per", "x", "the", "a", "il", "la", "lo", "le", "gli"]);

function tokens(s: string): string[] {
  return nameKey(s)
    .split(" ")
    .filter((t) => t && !STOP.has(t))
    .map((t) => (t.length > 4 ? t.replace(/[aeio]$/, "") : t)); // crude singular/plural folding
}

/** Token-set similarity: shared tokens / tokens of the shorter string. */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment * 0.9);
}

export function similarity(a: string, b: string): number {
  return Math.max(trigramSimilarity(a, b), tokenSimilarity(a, b));
}

export type BestMatch<T> = { item: T; score: number } | null;

export function bestMatch<T>(
  query: string,
  items: readonly T[],
  getName: (t: T) => string,
  threshold = 0.6,
): BestMatch<T> {
  let best: BestMatch<T> = null;
  for (const it of items) {
    const s = similarity(query, getName(it));
    if (s >= threshold && (!best || s > best.score)) best = { item: it, score: s };
  }
  return best;
}

/**
 * Small inverted index over token prefixes so matching against thousands of
 * known product names stays fast (candidates first, then full similarity).
 */
export class NameIndex<T> {
  private readonly byToken = new Map<string, number[]>();
  private readonly items: readonly T[];
  private readonly getName: (t: T) => string;
  constructor(items: readonly T[], getName: (t: T) => string) {
    this.items = items;
    this.getName = getName;
    items.forEach((it, i) => {
      for (const t of new Set(tokens(getName(it)))) {
        const key = t.slice(0, 4);
        const list = this.byToken.get(key) ?? [];
        list.push(i);
        this.byToken.set(key, list);
      }
    });
  }

  best(query: string, threshold = 0.6): BestMatch<T> {
    const cand = new Set<number>();
    for (const t of tokens(query)) for (const i of this.byToken.get(t.slice(0, 4)) ?? []) cand.add(i);
    let best: BestMatch<T> = null;
    for (const i of cand) {
      const it = this.items[i]!;
      const s = similarity(query, this.getName(it));
      if (s >= threshold && (!best || s > best.score)) best = { item: it, score: s };
    }
    return best;
  }
}
