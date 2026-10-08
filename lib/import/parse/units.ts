// Units, packs and price bases ("6x1L", "cassa da 5 kg", "125g x 8", "al kg").

import type { ContainerUnit, MeasureBase, PackInfo, SaleUnit } from "../types.ts";
import { fold } from "../text.ts";
import { parseNumber, round4 } from "./numbers.ts";

type Measure = "kg" | "g" | "hg" | "l" | "cl" | "ml";

const MEASURE_WORDS: Record<string, Measure> = {
  kg: "kg", kgs: "kg", kilo: "kg", kili: "kg", chilo: "kg", chili: "kg", chilogrammo: "kg",
  chilogrammi: "kg", kilogrammo: "kg", kilogrammi: "kg", kgr: "kg",
  g: "g", gr: "g", grr: "g", grammo: "g", grammi: "g", gramm: "g",
  hg: "hg", etto: "hg", etti: "hg",
  l: "l", lt: "l", ltr: "l", lit: "l", litro: "l", litri: "l",
  cl: "cl", ml: "ml",
};

const PIECE_WORDS = new Set([
  "pz", "pezzo", "pezzi", "pzz", "cad", "cadauno", "cadauna", "cadaun", "nr", "n", "num", "numero",
  "unita", "unit", "pc", "pcs",
]);

const CONTAINER_WORDS: Record<string, ContainerUnit> = {
  cartone: "cartone", cartoni: "cartone", crt: "cartone", ct: "cartone", cart: "cartone", ctn: "cartone",
  collo: "cartone", colli: "cartone", krt: "cartone",
  cassa: "cassa", casse: "cassa", cassetta: "cassa", cassette: "cassa", cs: "cassa", cass: "cassa", plateau: "cassa", plt: "cassa",
  conf: "confezione", confez: "confezione", confezione: "confezione", confezioni: "confezione", cf: "confezione", pacco: "confezione",
  pacchi: "confezione", pack: "confezione", pk: "confezione", scatola: "confezione", scatole: "confezione",
  sc: "confezione", fardello: "confezione", fardelli: "confezione", fard: "confezione", vaso: "confezione",
  vasetto: "confezione", vasetti: "confezione", barattolo: "latta", barattoli: "latta", vasi: "confezione",
  sacco: "sacco", sacchi: "sacco", sacchetto: "busta", sacchetti: "busta", sac: "sacco",
  busta: "busta", buste: "busta", bustina: "busta",
  vaschetta: "vaschetta", vaschette: "vaschetta", vasch: "vaschetta", vasc: "vaschetta", vsc: "vaschetta",
  secchio: "secchio", secchi: "secchio", secchiello: "secchio", secchielli: "secchio",
  latta: "latta", lattina: "latta", lattine: "latta", tin: "latta",
  bottiglia: "bottiglia", bottiglie: "bottiglia", btg: "bottiglia", bt: "bottiglia", bott: "bottiglia",
  bot: "bottiglia", bottiglietta: "bottiglia",
  fusto: "fusto", fusti: "fusto", tanica: "fusto", taniche: "fusto", bidone: "fusto", bidoni: "fusto", keg: "fusto",
  vassoio: "vassoio", vassoi: "vassoio",
  mazzo: "mazzo", mazzi: "mazzo", mazzetto: "mazzo", mazzetti: "mazzo", mz: "mazzo", maz: "mazzo",
  pallet: "pallet", bancale: "pallet", bancali: "pallet",
  rotolo: "rotolo", rotoli: "rotolo",
};

/** Map any unit word (folded, dots removed) to a SaleUnit. */
export function unitFromWord(word: string): SaleUnit | null {
  const w = fold(word).replace(/[.\s]/g, "");
  if (!w) return null;
  const m = MEASURE_WORDS[w];
  if (m) return m;
  if (PIECE_WORDS.has(w)) return "pz";
  const c = CONTAINER_WORDS[w];
  if (c) return c;
  return null;
}

export function isContainer(u: SaleUnit | null | undefined): u is ContainerUnit {
  return !!u && !["kg", "g", "hg", "l", "cl", "ml", "pz"].includes(u);
}

/** Measure → base + factor (125 g → 0.125 kg). */
export function toBase(value: number, unit: Measure): { value: number; base: "kg" | "l" } {
  switch (unit) {
    case "kg": return { value, base: "kg" };
    case "g": return { value: value / 1000, base: "kg" };
    case "hg": return { value: value / 10, base: "kg" };
    case "l": return { value, base: "l" };
    case "cl": return { value: value / 100, base: "l" };
    case "ml": return { value: value / 1000, base: "l" };
  }
}

const MEASURE_ALT = "kg|kgs|kgr|kilo|kili|chil[oi]|chilogramm[oi]|kilogramm[oi]|grammi|grammo|grr|gr|g|hg|ett[oi]|litri|litro|ltr|lt|l|cl|ml";
const CONTAINER_ALT = Object.keys(CONTAINER_WORDS).sort((a, b) => b.length - a.length).join("|");
const PIECE_ALT = "pezzi|pezzo|pzz|pz|pcs|pc|cadauno|cadauna|cad|nr";
const NUMS = String.raw`\d+(?:[.,]\d+)?`;

// "6x1L", "6 x 1,5 lt", "24x50cl", "6 bott. x 0,75 l"
const RE_N_X_SIZE = new RegExp(String.raw`(?<![\d.,])(\d{1,4})\s*(?:(?:${PIECE_ALT}|${CONTAINER_ALT})\.?\s*)?[x]\s*(${NUMS})\s*(${MEASURE_ALT})\b\.?`, "gi");
// "125g x 8", "50 cl x 24 pz", "1 kg x 10"
const RE_SIZE_X_N = new RegExp(String.raw`(?<![\d.,])(${NUMS})\s*(${MEASURE_ALT})\.?\s*[x]\s*(\d{1,3})(?![\d.,])\s*(?:(${PIECE_ALT})\b\.?)?`, "gi");
// "cassa da 5 kg", "crt 12 pz", "CT 6", "sacco 25kg", "conf. 500 g", "cartone x 6", "CF10PZ"
const RE_CONTAINER_QTY = new RegExp(String.raw`\b(${CONTAINER_ALT})\b\.?\s*(da|di|x|:)?\s*(${NUMS})\s*(${MEASURE_ALT}|${PIECE_ALT}|${CONTAINER_ALT})?\b\.?`, "gi");
// "12 bottiglie per cartone", "6 pz a cartone", "5 kg a cassa", "10 kg/cassa"
const RE_QTY_PER_CONTAINER = new RegExp(String.raw`(?<![\d.,])(${NUMS})\s*(${MEASURE_ALT}|${PIECE_ALT}|${CONTAINER_ALT})?\.?\s*(?:per|a|al|x|/)\s*(${CONTAINER_ALT})\b\.?`, "gi");
// "x6", "x 12 pz"
const RE_X_N = new RegExp(String.raw`(?<![a-z\d])x\s*(\d{1,3})(?![\d.,])\s*(?:(${PIECE_ALT})\b\.?)?`, "gi");
// "500g", "1 kg", "0,75 l"
const RE_SIZE = new RegExp(String.raw`(?<![\d.,])(${NUMS})\s*(${MEASURE_ALT})\b\.?`, "gi");
// "LT.5", "KG.1", "GR.500", "LT. 1,5" (unit first, dot-separated — ALL CAPS lists)
const RE_UNIT_DOT_SIZE = /\b(lt|ltr|kg|kgr|gr|ml|cl)\.\s?(\d+(?:,\d)?)(?![\d.,])(?!\s*(?:€|eur))/gi;
// "30 pz", "12 pezzi"
const RE_PIECES = new RegExp(String.raw`(?<![\d.,])(\d{1,4})\s*(${PIECE_ALT})\b\.?`, "gi");
// lone container word ("cartone", "a cassa", "CRT")
const RE_CONTAINER = new RegExp(String.raw`\b(${CONTAINER_ALT})\b\.?`, "gi");

// Price basis: "€/kg", "/kg", "al kg", "a cartone", "per kg", "il kg", "cad", "x kg", "€ kg"
const RE_BASIS_SLASH = new RegExp(String.raw`(?<=(?:€|§|\d|\beur|\beuro|\bprezzo)\s{0,2})/\s*(${MEASURE_ALT}|${PIECE_ALT}|${CONTAINER_ALT})\b\.?`, "gi");
const RE_BASIS_WORD = new RegExp(String.raw`\b(?:al|alla|allo|a|per|il|la|lo|x|ogni)\s+(${MEASURE_ALT}|pezzo|pz|${CONTAINER_ALT})\b\.?`, "gi");
const RE_BASIS_CAD = /\b(cad(?:auno|auna)?|cadaun[oa])\b\.?/gi;

export type Span = { start: number; end: number };

export type PackParse = {
  pack: PackInfo;
  /** Display string, e.g. "cartone 6 × 1 l". */
  format: string | null;
  /** Explicit price basis found ("al kg", "€/kg", "cad"). */
  basis: SaleUnit | null;
  /** Spans consumed (removed from the name). */
  spans: Span[];
  /** Lone unit token found without a number (e.g. "KG" column in text). */
  loneUnit: SaleUnit | null;
};

function overlaps(spans: Span[], s: number, e: number): boolean {
  return spans.some((x) => s < x.end && e > x.start);
}

function fmtNum(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

function measureOf(word: string): Measure | null {
  const u = unitFromWord(word);
  return u && ["kg", "g", "hg", "l", "cl", "ml"].includes(u) ? (u as Measure) : null;
}

/**
 * Parse pack / size / price-basis expressions in a product text.
 * Pure function; spans index into `text`.
 */
export function parsePack(text: string): PackParse {
  const spans: Span[] = [];
  const pack: PackInfo = {};
  let sizeDisplay: string | null = null;
  let basis: SaleUnit | null = null;
  let loneUnit: SaleUnit | null = null;

  const take = (re: RegExp, fn: (m: RegExpExecArray) => boolean) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const s = m.index;
      const e = m.index + m[0].length;
      if (overlaps(spans, s, e)) continue;
      if (fn(m)) spans.push({ start: s, end: e });
    }
  };

  // --- price basis first (so "€/kg" is not read as a size) ---------------
  take(RE_BASIS_SLASH, (m) => {
    const u = unitFromWord(m[1]!);
    if (!u) return false;
    basis ??= u;
    return true;
  });
  take(RE_BASIS_CAD, () => {
    basis ??= "pz";
    return true;
  });

  // --- multi packs ---------------------------------------------------------
  take(RE_N_X_SIZE, (m) => {
    const n = Number(m[1]);
    const v = parseNumber(m[2]!);
    const unit = measureOf(m[3]!);
    if (!n || v === null || !unit || pack.pieces) return false;
    pack.pieces = n;
    pack.pieceSize = toBase(v, unit);
    sizeDisplay = `${n} × ${fmtNum(v)} ${unit}`;
    return true;
  });
  take(RE_SIZE_X_N, (m) => {
    const v = parseNumber(m[1]!);
    const unit = measureOf(m[2]!);
    const n = Number(m[3]);
    if (!n || v === null || !unit || pack.pieces) return false;
    pack.pieces = n;
    pack.pieceSize = toBase(v, unit);
    sizeDisplay = `${n} × ${fmtNum(v)} ${unit}`;
    return true;
  });

  // --- containers with a quantity -------------------------------------------
  take(RE_QTY_PER_CONTAINER, (m) => {
    const container = CONTAINER_WORDS[fold(m[3]!).replace(/\./g, "")];
    const v = parseNumber(m[1]!);
    if (!container || v === null) return false;
    const unitWord = m[2];
    // "5,80 a cassa" is a price per case, not a quantity.
    if (!unitWord && !Number.isInteger(v)) return false;
    if (/€\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index))) return false;
    pack.container ??= container;
    const measure = unitWord ? measureOf(unitWord) : null;
    if (measure) {
      if (!pack.pieceSize) {
        pack.pieceSize = toBase(v, measure);
        pack.pieces ??= 1;
        sizeDisplay ??= `${fmtNum(v)} ${measure}`;
      }
    } else if (!pack.pieces) {
      pack.pieces = v;
      sizeDisplay ??= `${fmtNum(v)} pz`;
    }
    return true;
  });
  take(RE_CONTAINER_QTY, (m) => {
    const container = CONTAINER_WORDS[fold(m[1]!).replace(/\./g, "")];
    const connector = m[2];
    const v = parseNumber(m[3]!);
    if (!container || v === null || v === 0) return false;
    // "cartone 6x1L" — the multi-pack regex already consumed the numbers.
    const unitWord = m[4];
    const measure = unitWord ? measureOf(unitWord) : null;
    if (!unitWord) {
      // "bottiglia 0,75" or "cassa 14" (a price!) are ambiguous: without a unit
      // accept only integer piece counts introduced by "da/x" or written as
      // an uppercase abbreviation ("CT 6", "CRT 12").
      if (!Number.isInteger(v) || v > 500) return false;
      const abbrevUpper = m[1] === m[1]!.toUpperCase() && m[1]!.length <= 4;
      if (!connector && !abbrevUpper) return false;
    }
    pack.container ??= container;
    if (measure) {
      if (!pack.pieceSize) {
        pack.pieceSize = toBase(v, measure);
        pack.pieces ??= 1;
        sizeDisplay ??= `${fmtNum(v)} ${measure}`;
      }
    } else if (!pack.pieces) {
      pack.pieces = v;
      sizeDisplay ??= `${fmtNum(v)} pz`;
    }
    return true;
  });

  take(RE_X_N, (m) => {
    const n = Number(m[1]);
    if (!n || pack.pieces) return false;
    pack.pieces = n;
    return true;
  });

  take(RE_UNIT_DOT_SIZE, (m) => {
    const v = parseNumber(m[2]!);
    const unit = measureOf(m[1]!);
    if (v === null || !unit || v === 0 || pack.pieceSize) return false;
    pack.pieceSize = toBase(v, unit);
    sizeDisplay = pack.pieces && pack.pieces > 1 ? `${pack.pieces} × ${fmtNum(v)} ${unit}` : `${fmtNum(v)} ${unit}`;
    return true;
  });

  take(RE_SIZE, (m) => {
    const v = parseNumber(m[1]!);
    const unit = measureOf(m[2]!);
    if (v === null || !unit || v === 0) return false;
    if (pack.pieceSize) return false; // second size (e.g. "peso medio") — leave in the name
    pack.pieceSize = toBase(v, unit);
    sizeDisplay = pack.pieces && pack.pieces > 1 ? `${pack.pieces} × ${fmtNum(v)} ${unit}` : `${fmtNum(v)} ${unit}`;
    return true;
  });

  take(RE_PIECES, (m) => {
    const n = Number(m[1]);
    if (!n || pack.pieces) return false;
    pack.pieces = n;
    sizeDisplay ??= `${n} pz`;
    return true;
  });

  take(RE_BASIS_WORD, (m) => {
    const u = unitFromWord(m[1]!);
    if (!u) return false;
    basis ??= u;
    return true;
  });

  take(RE_CONTAINER, (m) => {
    const c = CONTAINER_WORDS[fold(m[1]!).replace(/\./g, "")];
    if (!c) return false;
    // "ct"/"cs"/"sc"/"bt" as plain words are too ambiguous unless uppercase.
    if (m[1]!.length <= 2 && m[1] !== m[1]!.toUpperCase()) return false;
    pack.container ??= c;
    return true;
  });

  // Lone measure/piece token ("Zucchine KG 1,80", "Basilico PZ 0,80").
  const lone = new RegExp(String.raw`(?<![\d.,/])\b(${MEASURE_ALT}|pz|pezzo|nr)\b\.?`, "gi");
  take(lone, (m) => {
    const u = unitFromWord(m[1]!);
    if (!u) return false;
    // single letters "l"/"g"/"n" are too ambiguous as lone tokens
    if (m[1]!.length === 1) return false;
    loneUnit ??= u;
    return true;
  });

  // Totals
  if (pack.pieceSize) {
    const n = pack.pieces ?? 1;
    pack.total = { value: round4(pack.pieceSize.value * n), base: pack.pieceSize.base };
  } else if (pack.pieces) {
    pack.total = { value: pack.pieces, base: "pz" };
  }

  let format: string | null = null;
  if (pack.container && sizeDisplay) format = `${pack.container} ${sizeDisplay}`;
  else if (pack.container && pack.pieces) format = `${pack.container} ${pack.pieces} pz`;
  else if (sizeDisplay) format = sizeDisplay;
  else if (pack.container) format = pack.container;
  else if (pack.pieces && pack.pieces > 1) format = `${pack.pieces} pz`;

  return { pack, format, basis, spans, loneUnit };
}

/** Base used for unit price comparison when the sale unit is a measure. */
export function measureBase(u: SaleUnit): MeasureBase | null {
  if (u === "kg" || u === "g" || u === "hg") return "kg";
  if (u === "l" || u === "cl" || u === "ml") return "l";
  if (u === "pz") return "pz";
  return null;
}

/**
 * Price per kg / l / pz.
 *  - price already per kg/l/pz → itself (g/hg/cl/ml converted)
 *  - price per container/piece with a known total → price / total
 */
export function computeUnitPrice(
  price: number,
  priceUnit: SaleUnit,
  pack: PackInfo,
): { value: number; base: MeasureBase } | null {
  if (!(price > 0)) return null;
  switch (priceUnit) {
    case "kg": return { value: price, base: "kg" };
    case "g": return { value: round4(price * 1000), base: "kg" };
    case "hg": return { value: round4(price * 10), base: "kg" };
    case "l": return { value: price, base: "l" };
    case "cl": return { value: round4(price * 100), base: "l" };
    case "ml": return { value: round4(price * 1000), base: "l" };
  }
  // price per piece or per container
  const total = priceUnit === "pz" ? (pack.pieceSize ? { value: pack.pieceSize.value, base: pack.pieceSize.base } : null) : pack.total;
  if (total && total.value > 0) return { value: round4(price / total.value), base: total.base };
  if (priceUnit === "pz") return { value: price, base: "pz" };
  return null;
}

export const SALE_UNIT_LABELS: Record<SaleUnit, string> = {
  kg: "kg", g: "g", hg: "hg", l: "l", cl: "cl", ml: "ml", pz: "pz",
  cartone: "cartone", cassa: "cassa", confezione: "conf.", sacco: "sacco", busta: "busta",
  vaschetta: "vaschetta", secchio: "secchio", latta: "latta", bottiglia: "bottiglia",
  fusto: "fusto", vassoio: "vassoio", mazzo: "mazzo", pallet: "pallet", rotolo: "rotolo",
};

export const ALL_SALE_UNITS = Object.keys(SALE_UNIT_LABELS) as SaleUnit[];
