// Pack-size parsing and normalized unit prices (€/kg, €/l, €/pz).
// Pure module (node --test friendly).

import { normalizeUnit } from "../../catalogs/normalize.ts";

export type Measure = "kg" | "l" | "pz";

/** How much of a base measure one ordered unit contains. */
export type PackSize = { measure: Measure; amount: number };

const WEIGHT_VOLUME: Record<string, { measure: Measure; factor: number }> = {
  kg: { measure: "kg", factor: 1 },
  g: { measure: "kg", factor: 0.001 },
  gr: { measure: "kg", factor: 0.001 },
  hg: { measure: "kg", factor: 0.1 },
  l: { measure: "l", factor: 1 },
  lt: { measure: "l", factor: 1 },
  ml: { measure: "l", factor: 0.001 },
  cl: { measure: "l", factor: 0.01 },
};

function num(raw: string): number {
  return Number(raw.replace(",", "."));
}

/** Size of one pack read from the product name ("125g x 8", "latta 5 l", "6x1l"). */
function packFromName(name: string): PackSize | null {
  // Own normalization: keep decimal separators (normalizeName drops them).
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[,;:!?'"`´()[\]{}]/g, " ")
    .replace(/\s+/g, " ");
  // weight/volume amount, e.g. "125 g", "5kg", "0.75 l", "lt 1"
  let amount: { measure: Measure; value: number } | null = null;
  const m1 = n.match(/(\d+(?:\.\d+)?)\s*(kg|gr|g|hg|lt|l|ml|cl)\b/);
  const m2 = !m1 ? n.match(/\b(kg|gr|g|hg|lt|l|ml|cl)\s*(\d+(?:\.\d+)?)\b/) : null;
  if (m1) {
    const u = WEIGHT_VOLUME[m1[2]!]!;
    amount = { measure: u.measure, value: num(m1[1]!) * u.factor };
  } else if (m2) {
    const u = WEIGHT_VOLUME[m2[1]!]!;
    amount = { measure: u.measure, value: num(m2[2]!) * u.factor };
  }
  // multiplier, e.g. "x 8", "8x", "da 12", "12 pz"
  let mult = 1;
  const x1 = n.match(/\bx\s*(\d+)\b/);
  const x2 = n.match(/\b(\d+)\s*x\b/);
  const x3 = n.match(/\bda\s*(\d+)\s*(pz|pezzi|bottiglie|vasetti|buste)?\b/);
  const x4 = n.match(/\b(\d+)\s*(pz|pezzi)\b/);
  const x5 = n.match(/(?:^|\s)(\d+)\s*x\s*(?=\d)/); // "6x1l", "6 x 0.75 l"
  const mm = x5 ?? x1 ?? x2 ?? x3 ?? x4;
  if (mm) {
    const v = Number(mm[1]);
    if (Number.isFinite(v) && v > 1 && v <= 500) mult = v;
  }
  if (amount && amount.value > 0) return { measure: amount.measure, amount: amount.value * mult };
  if (mult > 1) return { measure: "pz", amount: mult };
  return null;
}

/**
 * Pack size of an offer: the unit wins when it is a weight/volume (price per
 * kg / l), otherwise the name tells how much a "pz / cassa / confezione"
 * contains. Null when the pack is unknown (not comparable).
 */
export function packSize(name: string, unit: string): PackSize | null {
  const u = normalizeUnit(unit);
  const wv = WEIGHT_VOLUME[u];
  if (wv) return { measure: wv.measure, amount: wv.factor };
  const fromName = packFromName(name);
  if (fromName) return fromName;
  if (u === "pz") return { measure: "pz", amount: 1 };
  return null;
}

/** €/kg, €/l or €/pz for an offer, or null when its pack size is unknown. */
export function normalizedUnitPrice(
  name: string,
  unit: string,
  price: number,
): { measure: Measure; price: number } | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const pack = packSize(name, unit);
  if (!pack || pack.amount <= 0) return null;
  return { measure: pack.measure, price: price / pack.amount };
}

export const MEASURE_LABEL: Record<Measure, string> = { kg: "kg", l: "l", pz: "pz" };
