// Deterministic parser for orders dictated on the phone or pasted from
// WhatsApp ("5 kg pomodori datterini, 2 casse zucchine, mozzarella x3").
// Pure (no imports) so it is unit-testable with `node --test`.
//
// HOOK: this is intentionally simple and transparent (every match is shown to
// the sales rep, editable). The AI import pipeline (`lib/ai/import`, owned by
// another workstream) can replace it behind the same `OrderTextParser`
// signature without touching the form.

export type CatalogEntry = {
  id: string;
  name: string;
  unit: string;
  brand?: string | null;
};

export type ParsedLine = {
  raw: string;
  quantity: number;
  /** Unit written by the client, normalised (kg, g, l, pz, cassa…), if any. */
  unitHint: string | null;
  productId: string | null;
  /** 0–1 match confidence. */
  confidence: number;
  /** Up to 3 alternative product ids, best first (excluding productId). */
  alternatives: string[];
};

export type OrderTextParser = (text: string, catalog: CatalogEntry[]) => ParsedLine[];

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg", kili: "kg", kilo: "kg", chili: "kg", chilo: "kg", k: "kg",
  g: "g", gr: "g", grammi: "g",
  l: "l", lt: "l", litri: "l", litro: "l",
  ml: "ml",
  pz: "pz", pezzi: "pz", pezzo: "pz", n: "pz", nr: "pz",
  cassa: "cassa", casse: "cassa", cassetta: "cassa", cassette: "cassa", ct: "cassa", cass: "cassa",
  cartone: "cartone", cartoni: "cartone", crt: "cartone",
  conf: "confezione", confezione: "confezione", confezioni: "confezione", pacco: "confezione", pacchi: "confezione",
  bott: "bottiglia", bottiglia: "bottiglia", bottiglie: "bottiglia", bt: "bottiglia",
  latta: "latta", latte: "latta",
  vaschetta: "confezione", vaschette: "confezione",
  sacco: "confezione", sacchi: "confezione",
  mazzo: "pz", mazzi: "pz",
};

const STOPWORDS = new Set([
  "di", "del", "della", "dello", "dei", "degli", "delle", "da", "per", "con", "e", "ed",
  "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "x", "circa", "ca", "mi", "ci",
  "servono", "serve", "metti", "mandami", "mandate", "portate", "grazie", "ciao", "buongiorno",
  "domani", "anche", "poi", "solito", "solita",
]);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalizeText(s)
    .split(" ")
    .map((t) => t.replace(/[.,]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+([.,]\d+)?$/.test(t));
}

/** Loose Italian stem: drop the final vowel so pomodoro/pomodori, zucchina/zucchine match. */
function stem(t: string): string {
  return t.length > 4 ? t.replace(/[aeiou]$/, "") : t;
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = stem(a);
  const sb = stem(b);
  if (sa === sb) return true;
  return sa.length >= 4 && sb.length >= 4 && (sa.startsWith(sb) || sb.startsWith(sa));
}

export function scoreMatch(query: string[], entry: CatalogEntry): number {
  if (query.length === 0) return 0;
  const name = tokens(`${entry.name} ${entry.brand ?? ""}`);
  if (name.length === 0) return 0;
  const hitQ = query.filter((q) => name.some((n) => tokenMatch(q, n))).length;
  const nameCore = tokens(entry.name);
  const hitN = nameCore.filter((n) => query.some((q) => tokenMatch(q, n))).length;
  return 0.7 * (hitQ / query.length) + 0.3 * (nameCore.length ? hitN / nameCore.length : 0);
}

/** Split a message into candidate order lines. */
export function splitLines(text: string): string[] {
  return text
    .split(/\n|;|•|(?:,\s+(?=\d))|(?:,\s+(?=[a-zA-Z]))/)
    .map((l) => l.replace(/^[\s\-*–•]+/, "").trim())
    .filter((l) => l.length > 0);
}

const QTY_UNIT_RE =
  /(?:^|\s)(?:x\s*)?(\d+(?:[.,]\d+)?)\s*(?:x\b)?\s*([a-zA-Z]{1,12}\.?)?(?=\s|$)/;

export function extractQuantity(line: string): { quantity: number; unitHint: string | null; rest: string } {
  const norm = normalizeText(line);
  const m = norm.match(QTY_UNIT_RE);
  if (!m) return { quantity: 1, unitHint: null, rest: norm };
  const quantity = Number(m[1]!.replace(",", "."));
  const rawUnit = (m[2] ?? "").replace(/\.$/, "");
  const unitHint = rawUnit && UNIT_ALIASES[rawUnit] ? UNIT_ALIASES[rawUnit]! : null;
  // Remove the quantity (and the unit only when it was recognised as a unit).
  const consumed = unitHint ? m[0] : m[0].replace(m[2] ?? "", "");
  const rest = norm.replace(consumed, " ").replace(/\s+/g, " ").trim();
  return { quantity: quantity > 0 && Number.isFinite(quantity) ? quantity : 1, unitHint, rest };
}

export const parseOrderText: OrderTextParser = (text, catalog) => {
  const out: ParsedLine[] = [];
  for (const raw of splitLines(text).slice(0, 80)) {
    const { quantity, unitHint, rest } = extractQuantity(raw);
    const q = tokens(rest);
    if (q.length === 0) continue;
    const ranked = catalog
      .map((c) => ({ c, s: scoreMatch(q, c) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.c.name.length - b.c.name.length)
      .slice(0, 4);
    const best = ranked[0];
    const matched = best && best.s >= 0.5 ? best : null;
    let qty = quantity;
    // "500 g" of a product sold by the kg → 0,5.
    if (matched && unitHint === "g" && matched.c.unit === "kg") qty = Math.round((quantity / 1000) * 1000) / 1000;
    if (matched && unitHint === "ml" && (matched.c.unit === "lt" || matched.c.unit === "l")) {
      qty = Math.round((quantity / 1000) * 1000) / 1000;
    }
    out.push({
      raw,
      quantity: qty,
      unitHint,
      productId: matched ? matched.c.id : null,
      confidence: best ? Math.round(best.s * 100) / 100 : 0,
      alternatives: ranked.filter((r) => r !== matched).slice(0, 3).map((r) => r.c.id),
    });
  }
  return out;
};
