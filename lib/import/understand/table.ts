// Table understanding: header row detection, preamble, column roles.

import type { ColumnRole, SaleUnit } from "../types.ts";
import { fold } from "../text.ts";
import { findMoney, parseNumber } from "../parse/numbers.ts";
import { parsePack, unitFromWord } from "../parse/units.ts";

const ROLE_KEYWORDS: Array<[ColumnRole, RegExp, number]> = [
  ["code", /^(cod(ice)?\.?(\s*art(icolo)?\.?)?|cod\.?\s*prod(otto)?|sku|art\.?|art\.?\s*n\.?|n\.?\s*art\.?|rif\.?|riferimento|ean|barcode|codice\s+a\s+barre|id|plu)$/, 5],
  ["name", /(descrizione|prodotto|articolo|denominazione|^nome|^item|^product|^voce|^merce|^referenza|^specialit|^tipologia prodotto)/, 5],
  ["unit", /^(u\.?\s?m\.?|udm|u\.?\s?d\.?\s?m\.?|unit[aà](\s+di\s+(misura|vendita))?|misura|^unit$|^uom$|vendita\s+a|venduto\s+a)$/, 5],
  ["pack", /(formato|confezione|conf\.?$|^cf$|pezzatura|imballo|imballaggio|packaging|grammatura|^peso|pz\s*\/\s*(crt|ct|cartone)|pezzi\s+per|colli|^crt$|^ct$|cartone\s*da|contenuto|capacit)/, 4],
  ["price", /(prezzo|^€|euro|^eur$|costo|importo|^price|listino|netto|tariffa|p\.?\s?u\.?$|prz)/, 5],
  ["vat", /(^iva|aliquota|^vat|%\s*iva|^i\.v\.a)/, 5],
  ["brand", /(marca|marchio|^brand|produttore|^ditta)/, 4],
  ["category", /(categoria|reparto|famiglia|^gruppo|settore|^tipo$|^tipologia$|^linea$)/, 4],
  ["origin", /(origine|provenienza|^paese|nazione|^zona)/, 4],
  ["minQty", /(minimo|^min\.?|moq|ordine\s+min|q\.?\s?t[aà]\.?\s*min)/, 4],
  ["availability", /(disponibil|^disp\.?|^stato|stagional|^note$|^annotazioni|^osservazioni)/, 3],
  ["qty", /^(q\.?\s?t[aà]\.?|quantit[aà]|qty|qta|pezzi|n\.?\s*pz|numero)$/, 4],
];

export function roleFromHeader(cell: string): { role: ColumnRole; score: number } | null {
  const f = fold(cell).replace(/[_*]/g, " ").trim();
  if (!f) return null;
  for (const [role, re, score] of ROLE_KEYWORDS) {
    if (re.test(f)) {
      // "prezzo" + "cod" in the same header → price wins; "descrizione articolo" → name
      return { role, score };
    }
  }
  return null;
}

/** Header cell text hints the price basis ("Prezzo €/kg", "Prezzo cartone"). */
export function basisFromHeader(cell: string): SaleUnit | null {
  const f = fold(cell);
  const m = /(?:\/|al|a|per|x)\s*(kg|lt|l|pz|pezzo|cartone|ct|crt|cassa|conf|confezione|bottiglia|collo)\b/.exec(f);
  if (m) return unitFromWord(m[1]!);
  if (/prezzo\s+(cartone|cassa|confezione|collo|kg|pezzo)/.test(f)) return unitFromWord(/prezzo\s+(\w+)/.exec(f)![1]!);
  return null;
}

export type HeaderDetection = { index: number; roles: Record<number, ColumnRole>; score: number } | null;

/**
 * Find the header row in the first rows of a sheet: the row with the most
 * cells matching role keywords (≥2) and few numbers.
 */
export function detectHeader(rows: string[][], maxScan = 30): HeaderDetection {
  let best: HeaderDetection = null;
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const row = rows[i]!;
    const nonEmpty = row.filter((c) => c && c.trim());
    if (nonEmpty.length < 2) continue;
    const roles: Record<number, ColumnRole> = {};
    let score = 0;
    let hits = 0;
    const used = new Set<ColumnRole>();
    row.forEach((cell, idx) => {
      const r = roleFromHeader(cell ?? "");
      if (r && !used.has(r.role)) {
        roles[idx] = r.role;
        used.add(r.role);
        score += r.score;
        hits++;
      } else if (r && r.role === "price") {
        // second price column: keep it, decided later
        roles[idx] = "price";
        hits++;
      }
    });
    const numeric = nonEmpty.filter((c) => parseNumber(c) !== null).length;
    if (hits < 2 || numeric > nonEmpty.length / 3) continue;
    // need at least name or price among roles
    if (!used.has("name") && !used.has("price")) continue;
    if (!best || score > best.score) best = { index: i, roles, score };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Content statistics per column (for header-less or odd tables)
// ---------------------------------------------------------------------------

export type ColumnStats = {
  filled: number;
  priceLike: number;
  intLike: number;
  unitLike: number;
  packLike: number;
  textLike: number;
  codeLike: number;
  vatLike: number;
  avgLen: number;
  distinct: number;
};

export function columnStats(rows: string[][], col: number): ColumnStats {
  let filled = 0, priceLike = 0, intLike = 0, unitLike = 0, packLike = 0, textLike = 0, codeLike = 0, vatLike = 0, len = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const v = (r[col] ?? "").trim();
    if (!v) continue;
    filled++;
    len += v.length;
    seen.add(v.toLowerCase());
    const n = parseNumber(v);
    const money = findMoney(v);
    if (n !== null) {
      if (/^\d+$/.test(v.replace(/\s/g, ""))) intLike++;
      if (/[.,]\d{1,2}$/.test(v) || /€/.test(v)) priceLike++;
      if ([4, 5, 10, 22].includes(n) || /%/.test(v)) vatLike++;
    } else if (money.some((m) => m.euro)) {
      priceLike++;
    }
    if (unitFromWord(v) && v.length <= 12) unitLike++;
    else {
      const p = parsePack(v);
      if (p.format && v.replace(/[\d\s.,x×]/gi, "").length <= 12) packLike++;
    }
    if (/[a-zà-ú]{3,}/i.test(v) && v.length >= 4 && !unitFromWord(v)) textLike++;
    if (/^[A-Z0-9][A-Z0-9\-./]{2,18}$/i.test(v) && /\d/.test(v) && n === null) codeLike++;
    if (/^\d{4,13}$/.test(v)) codeLike += 0.5;
  }
  return {
    filled,
    priceLike: filled ? priceLike / filled : 0,
    intLike: filled ? intLike / filled : 0,
    unitLike: filled ? unitLike / filled : 0,
    packLike: filled ? packLike / filled : 0,
    textLike: filled ? textLike / filled : 0,
    codeLike: filled ? codeLike / filled : 0,
    vatLike: filled ? vatLike / filled : 0,
    avgLen: filled ? len / filled : 0,
    distinct: seen.size,
  };
}

/**
 * Infer column roles from content when headers are missing or unhelpful.
 * Existing roles (from headers / memory) are kept; only gaps are filled.
 */
export function inferRolesFromContent(
  rows: string[][],
  existing: Record<number, ColumnRole> = {},
): { roles: Record<number, ColumnRole>; stats: Record<number, ColumnStats> } {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const stats: Record<number, ColumnStats> = {};
  for (let c = 0; c < width; c++) stats[c] = columnStats(rows, c);
  const roles: Record<number, ColumnRole> = { ...existing };
  const taken = new Set(Object.values(roles));
  const free = () => Array.from({ length: width }, (_, i) => i).filter((i) => roles[i] === undefined && stats[i]!.filled > 0);

  const minFill = Math.max(1, rows.length * 0.3);

  if (!taken.has("name")) {
    const best = free()
      .filter((i) => stats[i]!.filled >= minFill)
      .sort((a, b) => stats[b]!.textLike * stats[b]!.avgLen - stats[a]!.textLike * stats[a]!.avgLen)[0];
    if (best !== undefined && stats[best]!.textLike >= 0.5) {
      roles[best] = "name";
      taken.add("name");
    }
  }
  if (!taken.has("price")) {
    // rightmost strongly price-like column (lists put the price last)
    const cands = free().filter((i) => stats[i]!.priceLike >= 0.5 && stats[i]!.filled >= minFill);
    const best = cands.sort((a, b) => stats[b]!.priceLike - stats[a]!.priceLike || b - a)[0];
    if (best !== undefined) {
      roles[best] = "price";
      taken.add("price");
    }
  }
  if (!taken.has("unit")) {
    const best = free().filter((i) => stats[i]!.unitLike >= 0.6).sort((a, b) => stats[b]!.unitLike - stats[a]!.unitLike)[0];
    if (best !== undefined) {
      roles[best] = "unit";
      taken.add("unit");
    }
  }
  if (!taken.has("pack")) {
    const best = free().filter((i) => stats[i]!.packLike >= 0.5).sort((a, b) => stats[b]!.packLike - stats[a]!.packLike)[0];
    if (best !== undefined) {
      roles[best] = "pack";
      taken.add("pack");
    }
  }
  if (!taken.has("code")) {
    const best = free().filter((i) => stats[i]!.codeLike >= 0.6 && stats[i]!.distinct >= stats[i]!.filled * 0.8)
      .sort((a, b) => a - b)[0];
    if (best !== undefined) {
      roles[best] = "code";
      taken.add("code");
    }
  }
  if (!taken.has("vat")) {
    const best = free().filter((i) => stats[i]!.vatLike >= 0.8 && stats[i]!.distinct <= 4)[0];
    if (best !== undefined) {
      roles[best] = "vat";
      taken.add("vat");
    }
  }
  return { roles, stats };
}

/** Signature used by the import memory to recognise a known layout. */
export function headerSignature(cells: string[]): string {
  return cells.map((c) => fold(c ?? "").replace(/[^a-z0-9%€]+/g, "")).join("|");
}

/** Pick the main price column among several ("Prezzo listino" vs "Prezzo netto"). */
export function choosePriceColumn(headerCells: string[], priceCols: number[]): { main: number; others: number[] } {
  if (priceCols.length <= 1) return { main: priceCols[0]!, others: [] };
  const score = (i: number) => {
    const f = fold(headerCells[i] ?? "");
    let s = 0;
    if (/netto|scontato|cliente|riservato|offerta|promo/.test(f)) s += 3;
    if (/listino|pubblico|consigliato|pvp|lordo|ivato|iva\s*incl/.test(f)) s -= 2;
    if (/unitario|p\.?\s?u|\/\s*(kg|pz|l|lt)|al\s+(kg|pz)/.test(f)) s += 1;
    return s;
  };
  const sorted = [...priceCols].sort((a, b) => score(b) - score(a) || a - b);
  return { main: sorted[0]!, others: sorted.slice(1) };
}
