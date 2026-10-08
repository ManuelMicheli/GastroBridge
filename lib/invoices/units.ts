// lib/invoices/units.ts
// Unit normalisation and pack math for invoice ↔ order ↔ recipe quantities.
//
// Every quantity is expressed as a Measure: the same physical amount in each
// dimension we can infer (pieces, kg, litres, packs). Two quantities are
// compared on the first dimension both sides know, so "2 CT di Acqua 0,5L x24"
// (invoice) and "48 bottiglie" (order) meet on `pz`, "3 PZ Mozzarella 1kg" and
// "3 kg" meet on `kg`. When no common dimension exists nothing is compared
// (no false positives).

export type BaseUnit = "kg" | "l" | "pz";
export type UnitKind = "weight" | "volume" | "count" | "pack" | "unknown";

export interface CanonicalUnit {
  /** Canonical short label: kg, g, l, ml, cl, pz, ct, cf, bt, lt (latta)… */
  code: string;
  kind: UnitKind;
  /** Factor to the base unit for weight/volume/count kinds. */
  factor: number;
}

const UNIT_TABLE: Array<[string[], CanonicalUnit]> = [
  [["kg", "kgm", "kgs", "kgr", "chilo", "chili", "chilogrammo", "chilogrammi", "kilo", "kilogrammo", "kilogrammi", "kl"], { code: "kg", kind: "weight", factor: 1 }],
  [["g", "gr", "grm", "grammo", "grammi", "grs"], { code: "g", kind: "weight", factor: 0.001 }],
  [["hg", "etto", "etti"], { code: "hg", kind: "weight", factor: 0.1 }],
  [["q", "ql", "quintale", "quintali"], { code: "q", kind: "weight", factor: 100 }],
  [["l", "lt", "ltr", "lit", "litro", "litri", "ltr", "lts"], { code: "l", kind: "volume", factor: 1 }],
  [["ml", "mlt", "millilitro", "millilitri"], { code: "ml", kind: "volume", factor: 0.001 }],
  [["cl", "centilitro", "centilitri"], { code: "cl", kind: "volume", factor: 0.01 }],
  [["pz", "pzz", "pezzo", "pezzi", "pc", "pcs", "pce", "ea", "c62", "nr", "n", "num", "numero", "cad", "cadauno", "cadauna", "un", "unita", "unit", "piece", "uni"], { code: "pz", kind: "count", factor: 1 }],
  [["dz", "dozzina", "dozzine"], { code: "dz", kind: "count", factor: 12 }],
  [["ct", "crt", "cart", "cartone", "cartoni", "box", "colli", "collo", "co", "car"], { code: "ct", kind: "pack", factor: 1 }],
  [["cf", "conf", "confezione", "confezioni", "pk", "pkg", "pac", "pacco", "pacchi", "pack", "bundle"], { code: "cf", kind: "pack", factor: 1 }],
  [["bt", "bot", "btg", "bott", "bottiglia", "bottiglie", "btl"], { code: "bt", kind: "pack", factor: 1 }],
  [["lat", "latta", "latte", "lattina", "lattine"], { code: "latta", kind: "pack", factor: 1 }],
  [["cs", "cassa", "casse", "cassetta", "cassette"], { code: "cassa", kind: "pack", factor: 1 }],
  [["vs", "vasch", "vaschetta", "vaschette", "vas", "vaso", "vasetto", "barattolo", "bar", "brt"], { code: "vs", kind: "pack", factor: 1 }],
  [["sc", "sac", "sacco", "sacchi"], { code: "sacco", kind: "pack", factor: 1 }],
  [["bs", "busta", "buste", "sacchetto"], { code: "busta", kind: "pack", factor: 1 }],
  [["fs", "fusto", "fusti", "tanica", "taniche"], { code: "fusto", kind: "pack", factor: 1 }],
  [["pallet", "bancale", "plt"], { code: "pallet", kind: "pack", factor: 1 }],
  [["forma", "forme", "ruota"], { code: "forma", kind: "pack", factor: 1 }],
  [["mazzo", "mazzi", "mz"], { code: "mazzo", kind: "pack", factor: 1 }],
];

const UNIT_INDEX = new Map<string, CanonicalUnit>();
for (const [aliases, unit] of UNIT_TABLE) for (const a of aliases) UNIT_INDEX.set(a, unit);

export function canonicalUnit(raw: string | null | undefined): CanonicalUnit {
  if (!raw) return { code: "", kind: "unknown", factor: 1 };
  const k = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return UNIT_INDEX.get(k) ?? { code: k, kind: "unknown", factor: 1 };
}

/** Base unit of a canonical unit (null for packs / unknown). */
export function baseOf(u: CanonicalUnit): BaseUnit | null {
  if (u.kind === "weight") return "kg";
  if (u.kind === "volume") return "l";
  if (u.kind === "count") return "pz";
  return null;
}

export interface PackInfo {
  /** Pieces per pack ("x 24", "conf. 12 pz"). */
  count: number | null;
  /** Size of one piece (or of the pack when count is null). */
  size: { qty: number; base: "kg" | "l" } | null;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const MU = String.raw`(kg|kgm|gr|g|hg|lt|ltr|l|ml|cl)`;

function n(s: string): number {
  return Number(s.replace(",", "."));
}

function sizeOf(qty: number, unit: string): { qty: number; base: "kg" | "l" } | null {
  const u = canonicalUnit(unit);
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  if (u.kind === "weight") return { qty: r6(qty * u.factor), base: "kg" };
  if (u.kind === "volume") return { qty: r6(qty * u.factor), base: "l" };
  return null;
}

/**
 * Pack information written in a product description, e.g.
 *   "Passata 6x700g" → 6 × 0.7 kg       "Acqua 0,5L x 24" → 24 × 0.5 l
 *   "Olio EVO lt 5"  → size 5 l          "Mozzarella 125 g" → size 0.125 kg
 *   "Uova conf. 30 pz" → 30 pieces       "Tovaglioli x100" → 100 pieces
 */
export function parsePack(description: string | null | undefined): PackInfo {
  const s = ` ${(description ?? "").toLowerCase().replace(/\s+/g, " ")} `;
  let m = new RegExp(String.raw`(\d+)\s*[x×*]\s*${NUM}\s*${MU}\b`).exec(s);
  if (m) return { count: Number(m[1]), size: sizeOf(n(m[2]!), m[3]!) };
  m = new RegExp(String.raw`${NUM}\s*${MU}\s*[x×*]\s*(\d+)\b`).exec(s);
  if (m) return { count: Number(m[3]), size: sizeOf(n(m[1]!), m[2]!) };
  let size: PackInfo["size"] = null;
  const numFirst = new RegExp(String.raw`(?:^|[\s(])${NUM}\s*${MU}\b`).exec(s);
  if (numFirst) {
    size = sizeOf(n(numFirst[1]!), numFirst[2]!);
  } else {
    const unitFirst = new RegExp(String.raw`\b${MU}\.?\s*${NUM}\b`).exec(s);
    if (unitFirst) size = sizeOf(n(unitFirst[2]!), unitFirst[1]!);
  }
  const cm =
    /(?:conf\.?|cf\.?|confezione|cartone|ct\.?|crt|scatola|box|da)\s*(?:da\s*)?(\d+)\s*(?:pz|pezzi|bt|bottiglie|lattine|uova|vasetti|vaschette|buste)?\b/.exec(s) ??
    /\b[x×]\s*(\d+)\b(?!\s*(?:kg|g|gr|l|lt|ml|cl))/.exec(s) ??
    /\b(\d+)\s*(?:pz|pezzi)\b/.exec(s);
  const count = cm ? Number(cm[1]) : null;
  return { count: count && count > 1 ? count : null, size };
}

export interface Measure {
  pz?: number;
  kg?: number;
  l?: number;
  /** Quantity in pack units, keyed by canonical pack code ("ct", "cf"…). */
  pack?: { code: string; qty: number };
}

export interface PackHint {
  /** Product packaging size (e.g. 6) and its unit (e.g. "lt", "pz"). */
  packagingSize?: number | null;
  packagingUnit?: string | null;
}

/**
 * Express `qty` of `unit` in every dimension that can be inferred from the
 * unit, the description and the optional product packaging hint.
 */
export function measureOf(
  qty: number,
  unitRaw: string | null | undefined,
  description: string | null | undefined,
  hint?: PackHint,
): Measure {
  const u = canonicalUnit(unitRaw);
  const pack = parsePack(description);
  if (hint?.packagingSize && hint.packagingSize > 0 && hint.packagingUnit) {
    const hu = canonicalUnit(hint.packagingUnit);
    if ((hu.kind === "weight" || hu.kind === "volume") && !pack.size && !pack.count) {
      pack.size = { qty: hint.packagingSize * hu.factor, base: hu.kind === "weight" ? "kg" : "l" };
    } else if (hu.kind === "count" && !pack.count) {
      pack.count = hint.packagingSize;
    }
  }
  const out: Measure = {};
  switch (u.kind) {
    case "weight":
      out.kg = qty * u.factor;
      break;
    case "volume":
      out.l = qty * u.factor;
      break;
    case "count": {
      const pieces = qty * u.factor;
      if (pack.count && pack.size) {
        // "Mozzarella 125g x 8" billed per PZ: the piece is the 8-pack.
        out[pack.size.base] = pieces * pack.count * pack.size.qty;
      } else {
        out.pz = pieces;
        if (pack.size) out[pack.size.base] = pieces * pack.size.qty;
      }
      break;
    }
    case "pack": {
      out.pack = { code: u.code, qty };
      if (pack.count) out.pz = qty * pack.count;
      if (pack.size) out[pack.size.base] = qty * (pack.count ?? 1) * pack.size.qty;
      break;
    }
    default: {
      // Unknown unit: trust the description only when it is explicit.
      if (pack.size && !pack.count) out[pack.size.base] = qty * pack.size.qty;
      else if (pack.count && pack.size) {
        out.pz = qty * pack.count;
        out[pack.size.base] = qty * pack.count * pack.size.qty;
      }
      if (u.code) out.pack = { code: u.code, qty };
      break;
    }
  }
  return out;
}

export type Dimension = "pack" | "kg" | "l" | "pz";

/** First dimension both measures know (same pack code first, then kg, l, pz). */
export function commonDimension(a: Measure, b: Measure): Dimension | null {
  if (a.pack && b.pack && a.pack.code === b.pack.code) return "pack";
  if (a.kg !== undefined && b.kg !== undefined) return "kg";
  if (a.l !== undefined && b.l !== undefined) return "l";
  if (a.pz !== undefined && b.pz !== undefined) return "pz";
  return null;
}

export function measureValue(m: Measure, d: Dimension): number | null {
  if (d === "pack") return m.pack?.qty ?? null;
  return m[d] ?? null;
}

export function dimensionLabel(d: Dimension, packCode?: string): string {
  if (d === "pack") return packCode || "conf.";
  return d;
}

/** Convert a recipe quantity (g, kg, ml, l, pz…) to its base unit. */
export function toBase(qty: number, unitRaw: string | null | undefined): { qty: number; base: BaseUnit } | null {
  const u = canonicalUnit(unitRaw);
  const b = baseOf(u);
  if (!b) return null;
  return { qty: qty * u.factor, base: b };
}

/** Best "price per base unit" from a price on `unit` (+ description/pack hint). */
export function basePrices(
  unitPrice: number,
  unitRaw: string | null | undefined,
  description: string | null | undefined,
  hint?: PackHint,
): Partial<Record<BaseUnit, number>> {
  const m = measureOf(1, unitRaw, description, hint);
  const out: Partial<Record<BaseUnit, number>> = {};
  for (const b of ["kg", "l", "pz"] as const) {
    const v = m[b];
    if (v !== undefined && v > 0) out[b] = unitPrice / v;
  }
  return out;
}
