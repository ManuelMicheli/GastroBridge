// Line classifier: product / supplier-info / header / section heading / noise.
// Every decision is a weighted sum of named features, so it can be explained.

import { fold } from "../text.ts";
import { findMoney } from "../parse/numbers.ts";
import { parsePack } from "../parse/units.ts";
import { supplierSignals } from "../parse/supplier-info.ts";
import { isNoiseText } from "../lexicon/misc.ts";
import { categoryFromHeading, classifyCategory } from "../lexicon/categories.ts";

export type LineClass = "product" | "supplier" | "header" | "section" | "noise";

export type LineFeatures = {
  hasEuro: boolean;
  moneyCount: number;
  decimalsCount: number;
  hasPack: boolean;
  letters: number;
  words: number;
  digitsRatio: number;
  upperRatio: number;
  supplier: number;
  headerWords: number;
  noise: boolean;
  categoryWord: boolean;
  endsWithColon: boolean;
};

export type Classification = { cls: LineClass; scores: Record<LineClass, number>; features: LineFeatures };

const HEADER_WORDS = [
  "descrizione", "articolo", "prodotto", "prodotti", "denominazione", "codice", "cod", "prezzo", "prezzi", "um", "u.m",
  "unita", "q.ta", "qta", "quantita", "iva", "formato", "confezione", "imballo", "marca", "categoria", "importo",
  "listino", "netto", "euro", "eur", "origine", "note", "disponibilita", "pezzatura", "peso", "ean", "sku", "item",
  "price", "description",
];

export function lineFeatures(line: string): LineFeatures {
  const money = findMoney(line).filter((c) => c.value > 0);
  const pack = parsePack(line);
  const letters = (line.match(/[a-zà-ú]/gi) ?? []).length;
  const digits = (line.match(/\d/g) ?? []).length;
  const uppers = (line.match(/[A-ZÀ-Þ]/g) ?? []).length;
  const words = line.split(/\s+/).filter((w) => /[a-zà-ú]{2,}/i.test(w)).length;
  const f = fold(line);
  const tokens = f.split(/[^a-z.]+/).filter(Boolean).map((t) => t.replace(/\.$/, ""));
  const headerWords = tokens.filter((t) => HEADER_WORDS.includes(t)).length;
  const sig = supplierSignals(line);
  return {
    hasEuro: money.some((m) => m.euro),
    moneyCount: money.length,
    decimalsCount: money.filter((m) => m.decimals).length,
    hasPack: Boolean(pack.format || pack.basis || pack.loneUnit),
    letters,
    words,
    digitsRatio: line.length ? digits / line.length : 0,
    upperRatio: letters ? uppers / letters : 0,
    supplier: sig.count,
    headerWords,
    noise: isNoiseText(line),
    categoryWord: categoryFromHeading(line) !== null,
    endsWithColon: /:\s*$/.test(line),
  };
}

/**
 * Classify one text line. `prev` lets the caller pass context (e.g. the line
 * is inside an email signature block).
 */
export function classifyLine(line: string): Classification {
  const ft = lineFeatures(line);
  const s: Record<LineClass, number> = { product: 0, supplier: 0, header: 0, section: 0, noise: 0 };

  // product evidence
  if (ft.hasEuro) s.product += 3;
  if (ft.decimalsCount > 0) s.product += 2;
  else if (ft.moneyCount > 0) s.product += 0.8;
  if (ft.hasPack) s.product += 1.2;
  if (ft.letters >= 3 && ft.words >= 1) s.product += 1;
  if (ft.letters < 3) s.product -= 3;
  const cat = classifyCategory(line);
  if (cat.category !== "altro" && cat.confidence >= 0.6) s.product += 1;

  // supplier evidence
  s.supplier += ft.supplier * 2.2;
  if (ft.supplier > 0 && ft.decimalsCount === 0 && !ft.hasEuro) s.supplier += 1;

  // header evidence
  if (ft.headerWords >= 2 && ft.decimalsCount === 0) s.header += 2 + ft.headerWords;

  // section heading: short, no numbers, uppercase or ends with ":" or a category word
  const shortText = ft.words >= 1 && ft.words <= 5 && ft.moneyCount === 0 && !ft.hasPack && ft.digitsRatio < 0.05;
  if (shortText) {
    if (ft.categoryWord) s.section += 3.5;
    if (ft.upperRatio > 0.8 && ft.letters >= 4) s.section += 1.5;
    if (ft.endsWithColon) s.section += 1.5;
  }

  // noise
  if (ft.noise) s.noise += 4;
  if (ft.moneyCount === 0 && !ft.hasPack && !shortText && ft.supplier === 0) s.noise += 1.5;
  if (ft.words > 14 && ft.decimalsCount === 0) s.noise += 2;

  let cls: LineClass = "noise";
  let best = -Infinity;
  for (const k of ["product", "supplier", "header", "section", "noise"] as LineClass[]) {
    if (s[k] > best) {
      best = s[k];
      cls = k;
    }
  }
  return { cls, scores: s, features: ft };
}
