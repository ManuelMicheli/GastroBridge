/**
 * Normalize a product name for matching:
 * lowercase + trim + strip diacritics + strip punctuation + collapse whitespace.
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?'"`´()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map of unit synonyms to canonical short form so "Kg", "kilogrammo",
 * "Litro", "L.", "Pz", "Cad" all collapse to a single bucket.
 */
const UNIT_SYNONYMS: Record<string, string> = {
  // weight
  kg: "kg", "kg.": "kg", chilogrammo: "kg", chilogrammi: "kg", chilo: "kg",
  chili: "kg", kilo: "kg", kilogrammo: "kg", kilogrammi: "kg",
  g: "g", gr: "g", grammo: "g", grammi: "g", "g.": "g", "gr.": "g",
  hg: "hg", etto: "hg", etti: "hg",
  // volume
  l: "l", "l.": "l", lt: "l", litro: "l", litri: "l", "lt.": "l",
  ml: "ml", millilitro: "ml", millilitri: "ml",
  cl: "cl", centilitro: "cl", centilitri: "cl",
  // count
  pz: "pz", "pz.": "pz", pezzo: "pz", pezzi: "pz", cad: "pz",
  cadauno: "pz", cadaun: "pz", n: "pz", "n.": "pz", nr: "pz", "nr.": "pz",
  // packaging
  cf: "cf", conf: "cf", "conf.": "cf", confezione: "cf", confezioni: "cf",
  cassa: "cassa", casse: "cassa",
  cartone: "cartone", cartoni: "cartone", ct: "cartone",
  bottiglia: "bottiglia", bottiglie: "bottiglia", btg: "bottiglia",
};

/**
 * Normalize a unit and map common Italian synonyms to a canonical form.
 * Unknown units are returned lowercased + diacritics-stripped + trimmed.
 */
export function normalizeUnit(raw: string): string {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return UNIT_SYNONYMS[cleaned] ?? cleaned;
}

/**
 * Parse a price that may be in Italian format: "12,50", "€ 12,50", "12.50 €", "1.234,56".
 * Returns null if it cannot be parsed into a finite non-negative number.
 */
export function normalizePrice(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : null;
  if (typeof raw !== "string") return null;

  let s = raw.trim();
  if (s.length === 0) return null;

  s = s.replace(/€|eur|euro/gi, "").replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Italian: dots are thousands separators, comma is decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  // If only dots, trust them as decimal separator.

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
