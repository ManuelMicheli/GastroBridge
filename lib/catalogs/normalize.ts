/** Lowercase, trim, and collapse internal whitespace. */
export function normalizeName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Lowercase + trim. */
export function normalizeUnit(raw: string): string {
  return raw.trim().toLowerCase();
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
