// Italian number / price parsing.

/**
 * Parse a number written the Italian (or English) way:
 *   "1.234,56" → 1234.56   "3,20" → 3.2   "3.20" → 3.2   "1.234" → 1234
 *   "1,234.56" → 1234.56   "12" → 12      "€ 3,2" → 3.2
 * Returns null when the string is not a single number.
 */
export function parseNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw)
    .replace(/[€\s ]|eur(?:o)?/gi, "")
    .replace(/^\+/, "")
    .trim();
  if (!s) return null;
  if (!/^-?[\d.,']+$/.test(s)) return null;
  s = s.replace(/'/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Both separators: the rightmost one is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    if (parts.length > 2) s = s.replace(/,/g, ""); // 1,234,567
    else s = s.replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    if (parts.length > 2) {
      s = s.replace(/\./g, ""); // 1.234.567
    } else if (parts[1]!.length === 3 && parts[0]!.length >= 1 && parts[0] !== "0") {
      // "1.234" is ambiguous; Italian lists use it as thousands. Prices with
      // three decimals ("1.234 €/kg") are rare enough to accept the bias.
      s = s.replace(".", "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Format a price the Italian way: 1234.5 → "1.234,50 €". */
export function formatEuro(n: number): string {
  return `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// ---------------------------------------------------------------------------
// Money candidates inside a line
// ---------------------------------------------------------------------------

export type MoneyCandidate = {
  value: number;
  start: number;
  end: number;
  /** € / eur / euro adjacent to the number. */
  euro: boolean;
  /** Has 1–2 decimal digits ("3,20", "3.5"). */
  decimals: boolean;
  /** Written as "3 e 20" (spoken style). */
  spoken: boolean;
  raw: string;
};

// number: 1.234,56 | 1234,56 | 3.20 | 3 | 1 234,56
const NUM = String.raw`\d{1,3}(?:[.\s']\d{3})+(?:[.,]\d{1,4})?|\d+(?:[.,]\d{1,4})?`;
const MONEY_RE = new RegExp(
  String.raw`(€\s*|\beur(?:o)?\b\.?\s*)?(${NUM})(\s*(?:€|eur(?:o)?\b)|,-)?`,
  "gi",
);
const SPOKEN_RE = /(?<![\d,.])(\d{1,4})\s+e\s+(\d{2})(?![\d,.])(?:\s*(?:€|euro))?/gi;

/**
 * Every number in a line that could be a price, left to right. The caller
 * decides which one is the price (see understand/product-line.ts).
 */
export function findMoney(line: string): MoneyCandidate[] {
  const out: MoneyCandidate[] = [];
  MONEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MONEY_RE.exec(line))) {
    const numStr = m[2]!;
    // Skip numbers glued to letters on the left ("A123", "x6" handled by units).
    const before = line[m.index - 1];
    if (!m[1] && before && /[a-zà-ú\d]/i.test(before)) continue;
    // Thousands with spaces only when a € follows/precedes — "6 500" is too risky.
    if (/\s/.test(numStr) && !m[1] && !m[3]) {
      // re-scan only the first group of digits
      const first = /^\d+/.exec(numStr)![0];
      const startNum = m.index + m[0].indexOf(numStr);
      out.push({
        value: Number(first),
        start: startNum,
        end: startNum + first.length,
        euro: false,
        decimals: false,
        spoken: false,
        raw: first,
      });
      MONEY_RE.lastIndex = startNum + first.length;
      continue;
    }
    const value = parseNumber(numStr.replace(/\s/g, ""));
    if (value === null) continue;
    const startNum = m.index + m[0].indexOf(numStr);
    let euro = Boolean(m[1] || m[3]);
    let end = m.index + m[0].length;
    // "24 € 5,80": the € introduces the next amount, it is not a suffix of 24.
    if (m[3] && !m[1] && /^\s*\d+(?:[.,]\d{1,2})/.test(line.slice(end)) && m[3].trim() === "€") {
      euro = false;
      end = startNum + numStr.length;
      MONEY_RE.lastIndex = end;
    }
    out.push({
      value,
      start: m[1] ? m.index : startNum,
      end,
      euro,
      decimals: /[.,]\d{1,2}$/.test(numStr) && !/[.,]\d{3}$/.test(numStr),
      spoken: false,
      raw: m[0].trim(),
    });
  }

  SPOKEN_RE.lastIndex = 0;
  while ((m = SPOKEN_RE.exec(line))) {
    const value = Number(m[1]) + Number(m[2]) / 100;
    out.push({
      value: round2(value),
      start: m.index,
      end: m.index + m[0].length,
      euro: /€|euro/i.test(m[0]),
      decimals: true,
      spoken: true,
      raw: m[0].trim(),
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------
// VAT
// ---------------------------------------------------------------------------

export const VAT_RATES = [4, 5, 10, 22] as const;

export type VatMatch = { rate: number | null; included: boolean | null; start: number; end: number };

const VAT_RE =
  /\(?\s*(?:\+\s*)?(?<![A-Za-zÀ-ú'’])(?:i\.?\s?v\.?\s?a\.?|iva|vat|aliquota)(?![A-Za-zÀ-ú])\s*(?:al\s*)?(?:(\d{1,2})\s*%?)?\s*(inclusa|incl\.?|compresa|esclusa|escl\.?|esente|non\s+inclusa)?\s*\)?|\b(\d{1,2})\s*%\s*(?:di\s+)?iva\b/i;

/** Find "iva 10%", "+IVA", "IVA esclusa", "22% iva" inside a line. */
export function findVat(line: string): VatMatch | null {
  const m = VAT_RE.exec(line);
  if (!m) return null;
  const rateStr = m[1] ?? m[3];
  const rate = rateStr ? Number(rateStr) : null;
  const word = (m[2] ?? "").toLowerCase();
  let included: boolean | null = null;
  if (/^(inclusa|incl|compresa)/.test(word)) included = true;
  else if (/^(esclusa|escl|non)/.test(word) || /\+/.test(m[0])) included = false;
  if (rate !== null && !(VAT_RATES as readonly number[]).includes(rate)) {
    return { rate: null, included, start: m.index, end: m.index + m[0].length };
  }
  return { rate, included, start: m.index, end: m.index + m[0].length };
}
