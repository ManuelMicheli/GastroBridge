// lib/invoices/text.ts
// Deterministic product-name similarity for invoice ↔ order ↔ catalog lines.
// No ML: normalisation, Italian food abbreviations, light stemming, token
// Dice coefficient with prefix tolerance + character trigram Jaccard.

const STOPWORDS = new Set([
  "di", "da", "del", "della", "dello", "dei", "degli", "delle", "al", "alla", "allo", "ai", "agli", "alle",
  "con", "e", "ed", "per", "in", "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "a", "x", "su",
  "kg", "g", "gr", "grammi", "hg", "lt", "l", "ml", "cl", "litri", "litro", "pz", "pezzi", "pezzo", "nr", "n",
  "conf", "cf", "ct", "crt", "cartone", "cartoni", "confezione", "confezioni", "busta", "buste", "vaschetta",
  "vasch", "sacco", "latta", "bottiglia", "bott", "btg", "cassa", "colli", "collo", "circa", "art", "cod",
  "tipo", "formato", "fresco", "fresca", "freschi", "fresche",
]);

const ABBREVIATIONS: Record<string, string> = {
  mozz: "mozzarella",
  mozzar: "mozzarella",
  pom: "pomodoro",
  pomod: "pomodoro",
  parm: "parmigiano",
  reg: "reggiano",
  prosc: "prosciutto",
  pros: "prosciutto",
  crud: "crudo",
  cott: "cotto",
  form: "formaggio",
  formagg: "formaggio",
  ins: "insalata",
  pat: "patate",
  fil: "filetto",
  pett: "petto",
  poll: "pollo",
  sals: "salsiccia",
  sem: "semola",
  far: "farina",
  zucch: "zucchine",
  melanz: "melanzane",
  bur: "burro",
  pan: "panna",
  evo: "extravergine",
  extraverg: "extravergine",
  ev: "extravergine",
  olio: "olio",
  aceto: "aceto",
  balsam: "balsamico",
  surg: "surgelato",
  surgel: "surgelato",
  dop: "dop",
  igp: "igp",
};

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MEASURE_TOKEN = /^\d+([.,]\d+)?(kg|g|gr|grammi|hg|lt|l|ml|cl|pz|x|cf|ct)?$|^x\d+$|^\d+x\d*/;

function stem(token: string): string {
  if (token.length > 4 && /[aeio]$/.test(token)) return token.slice(0, -1);
  return token;
}

/** Meaningful tokens of a product description (stemmed, abbreviations expanded). */
export function productTokens(raw: string): string[] {
  const out: string[] = [];
  for (const t0 of normalizeText(raw).split(" ")) {
    if (!t0) continue;
    if (MEASURE_TOKEN.test(t0)) continue;
    const t = ABBREVIATIONS[t0] ?? t0;
    if (STOPWORDS.has(t) || t.length < 2) continue;
    out.push(stem(t));
  }
  return out;
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s);
}

/** Dice coefficient on tokens, tolerant to prefixes ("parmig" ~ "parmigian"). */
export function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const used = new Set<number>();
  let hits = 0;
  for (const x of a) {
    const j = b.findIndex((y, k) => !used.has(k) && tokenMatch(x, y));
    if (j !== -1) {
      used.add(j);
      hits += 1;
    }
  }
  return (2 * hits) / (a.length + b.length);
}

function trigrams(s: string): Set<string> {
  const t = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

export function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 0..1 similarity between two product descriptions. */
export function productSimilarity(a: string, b: string): number {
  const ta = productTokens(a);
  const tb = productTokens(b);
  const tok = tokenSimilarity(ta, tb);
  const tri = trigramSimilarity(ta.join(" "), tb.join(" "));
  return Math.min(1, 0.65 * tok + 0.35 * tri);
}

/** Normalise an article / supplier code for exact comparison. */
export function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+(?=\d)/, "");
  return s.length >= 2 ? s : null;
}

/** Stable key of a product name (used for price history of unmatched lines). */
export function productKeyName(raw: string): string {
  const toks = productTokens(raw);
  return (toks.length > 0 ? toks : normalizeText(raw).split(" ")).slice(0, 8).join(" ");
}

/** Similarity between two company names ("Rossi Carni S.r.l." ~ "ROSSI CARNI SRL"). */
export function companySimilarity(a: string, b: string): number {
  const clean = (s: string) =>
    normalizeText(s)
      .replace(/\b(s ?r ?l ?s?|s ?p ?a|s ?n ?c|s ?a ?s|soc|societa|coop|cooperativa|ditta|di|srls|unipersonale|semplificata|a ?r ?l)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const ca = clean(a);
  const cb = clean(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  const ta = ca.split(" ");
  const tb = cb.split(" ");
  return Math.max(tokenSimilarity(ta, tb), trigramSimilarity(ca, cb));
}
