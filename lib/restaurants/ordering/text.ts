// Deterministic Italian product-name matching (no AI, no network).
// Pure module: relative imports only, so it runs under `node --test`.

import { normalizeName, normalizeUnit } from "../../catalogs/normalize.ts";

export { normalizeName, normalizeUnit };

const STOPWORDS = new Set([
  "di", "del", "della", "dello", "dei", "degli", "delle", "da", "dal", "dalla",
  "al", "alla", "allo", "ai", "agli", "alle", "in", "con", "per", "e", "ed",
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "a", "su", "tipo",
]);

// Packaging / measure words never identify the product itself.
const MEASURE_WORDS = new Set([
  "kg", "g", "gr", "hg", "etto", "etti", "l", "lt", "ml", "cl", "litro", "litri",
  "pz", "pezzo", "pezzi", "cad", "conf", "confezione", "confezioni", "cf",
  "cassa", "casse", "cassetta", "cassette", "cartone", "cartoni", "ct", "busta",
  "buste", "sacco", "sacchi", "vaschetta", "vaschette", "bottiglia", "bottiglie",
  "latta", "barattolo", "barattoli", "vasetto", "vasetti", "mazzo",
  "mazzi", "fardello", "fardelli", "x", "n", "nr",
]);

/**
 * Light Italian stemmer: folds singular/plural and gender ("datterini" →
 * "datterin", "mozzarella"/"mozzarelle" → "mozzarell", "albicocche" →
 * "albicocc"). Good enough to align list names with catalog names.
 */
export function stem(token: string): string {
  let t = token;
  if (t.length > 3 && /[aeiou]$/.test(t)) t = t.slice(0, -1);
  if (t.length > 3 && /[cg]h$/.test(t)) t = t.slice(0, -1);
  return t;
}

/** Content tokens of a product name: normalized, without stopwords, measures and pure numbers. */
export function productTokens(raw: string): string[] {
  const norm = normalizeName(raw)
    // "125g", "5kg", "x6", "6x" are pack info, not product identity
    .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|gr|hg|l|lt|ml|cl|pz)\b/g, " ")
    .replace(/\bx\s*\d+\b|\b\d+\s*x\b/g, " ")
    .replace(/[-/+*%&]/g, " ");
  const out: string[] = [];
  for (const tok of norm.split(/\s+/)) {
    if (!tok || STOPWORDS.has(tok) || MEASURE_WORDS.has(tok)) continue;
    if (/^\d+(?:[.,]\d+)?$/.test(tok)) continue;
    if (tok.length < 2) continue;
    out.push(stem(tok));
  }
  return out;
}

/**
 * Similarity in [0, 1] between a query (what the cook wrote) and a catalog
 * name. Coverage of the query tokens dominates; a small bonus rewards
 * catalog names without many extra words (more specific match).
 */
export function matchScore(queryTokens: string[], offerTokens: string[]): number {
  if (queryTokens.length === 0 || offerTokens.length === 0) return 0;
  let hit = 0;
  for (const q of queryTokens) {
    if (offerTokens.includes(q)) {
      hit += 1;
      continue;
    }
    // Prefix match for abbreviations ("pomod" / "pomodor") and compound words.
    if (q.length >= 4 && offerTokens.some((o) => o.startsWith(q) || (o.length >= 4 && q.startsWith(o)))) {
      hit += 0.8;
    }
  }
  const coverage = hit / queryTokens.length;
  if (coverage === 0) return 0;
  const precision = Math.min(1, hit / offerTokens.length);
  // The first query word is usually the product ("pomodoro datterino"):
  // missing it is a strong signal of a wrong match.
  const head = queryTokens[0]!;
  const headHit = offerTokens.some((o) => o === head || (head.length >= 4 && (o.startsWith(head) || head.startsWith(o))));
  const score = coverage * 0.8 + precision * 0.2;
  return headHit ? score : score * 0.6;
}

/** Minimum score for an automatic match. */
export const MATCH_THRESHOLD = 0.55;

/** Key shared by the price memory trigger and par levels for catalog lines. */
export function catalogItemKey(catalogId: string, productNameNormalized: string, unit: string): string {
  return `c:${catalogId}:${productNameNormalized}|${unit.trim().toLowerCase()}`;
}

export function productItemKey(productId: string): string {
  return `p:${productId}`;
}

/** Strip the " (unit)" suffix the search page appends to cart line names. */
export function stripUnitSuffix(name: string): string {
  return name.replace(/\s*\([^()]{1,24}\)\s*$/, "").trim();
}
