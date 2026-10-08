// Turn parsed text + context into an ExtractedProduct with confidences.

import type { ExtractedProduct, FieldConfidence, ImportHints, KnownProduct, SaleUnit } from "../types.ts";
import type { ParsedText } from "./product-line.ts";
import { defaultPriceUnit } from "./product-line.ts";
import { expandAbbreviations } from "../lexicon/abbreviations.ts";
import { CATEGORY_LABELS, classifyCategory, type ImportCategory } from "../lexicon/categories.ts";
import { computeUnitPrice, isContainer, measureBase, SALE_UNIT_LABELS } from "../parse/units.ts";
import { fold, isMostlyUpper, nameKey, normalizeCase, sentenceCase } from "../text.ts";
import type { NameIndex } from "../match/similarity.ts";

export type BuildContext = {
  hints: ImportHints;
  knownIndex: NameIndex<KnownProduct> | null;
  ocr: boolean;
};

export type BuildExtra = {
  id: string;
  original: string;
  section: string | null;
  sectionCategory: ImportCategory | null;
  /** Unit stated by a table column ("UM" = KG) — strong basis signal. */
  tableUnit?: SaleUnit | null;
  /** Basis from the price column header ("Prezzo €/kg"). */
  headerBasis?: SaleUnit | null;
  /** Price from a table cell (overrides parsed.price). */
  cellPrice?: { value: number; score: number; reason: string } | null;
  code?: string | null;
  brand?: string | null;
  vatRate?: number | null;
  origin?: string | null;
  availability?: string | null;
  minQty?: ExtractedProduct["minQty"];
  /** Category stated by a table column. */
  cellCategory?: ImportCategory | null;
};

const fc = (score: number, reason: string): FieldConfidence => ({ score: Math.round(score * 100) / 100, reason });

/** "Spaghetti de cecco" → "Spaghetti De Cecco" when the brand is known. */
function restoreBrandCase(name: string, brand: string | null): string {
  if (!brand) return name;
  const fb = fold(brand);
  const fn = fold(name);
  const i = fn.indexOf(fb);
  if (i < 0 || fn.length !== name.length) return name;
  return name.slice(0, i) + brand + name.slice(i + brand.length);
}

const OCR_GARBAGE = /[|~^{}<>\\]|[a-z][0-9][a-z]|[0-9][a-z]{1}[0-9]/i;

/** Returns null when the memory says this line must be skipped. */
export function buildProduct(parsed: ParsedText, extra: BuildExtra, ctx: BuildContext): ExtractedProduct | null {
  const issues = [...parsed.issues];
  const sourceKey = `${nameKey(parsed.nameRaw)}${parsed.format ? `|${nameKey(parsed.format)}` : ""}`;
  const hint = ctx.hints.products[sourceKey] ?? ctx.hints.products[nameKey(parsed.nameRaw)];
  if (hint?.ignore) return null;
  const fromMemory = Boolean(hint && (hint.name || hint.category || hint.priceUnit));

  // ---- name ---------------------------------------------------------------
  const allCaps = isMostlyUpper(parsed.nameRaw);
  const exp = expandAbbreviations(normalizeCase(parsed.nameRaw), ctx.hints.abbreviations, { allCaps });
  let name = restoreBrandCase(sentenceCase(exp.text), extra.brand ?? parsed.brand);
  let nameConf: FieldConfidence;
  if (hint?.name) {
    name = hint.name;
    nameConf = fc(0.97, "Nome corretto in un import precedente");
  } else if (name.replace(/[^a-zà-ú]/gi, "").length < 3) {
    nameConf = fc(0.15, "Nome mancante o troppo corto");
    issues.push("Nome del prodotto non riconosciuto");
  } else if (exp.unknown.length > 0) {
    nameConf = fc(0.62, `Abbreviazioni da verificare: ${exp.unknown.join(", ")}`);
    issues.push(`Abbreviazioni non riconosciute: ${exp.unknown.join(", ")}`);
  } else {
    nameConf = fc(exp.expanded.length > 0 ? 0.88 : 0.92, exp.expanded.length > 0 ? `Abbreviazioni espanse (${exp.expanded.slice(0, 3).join(", ")})` : "Nome letto dal testo");
  }
  if (ctx.ocr && !hint?.name) {
    if (OCR_GARBAGE.test(parsed.nameRaw)) {
      nameConf = fc(Math.min(nameConf.score, 0.45), "Testo da foto con caratteri dubbi");
      issues.push("Testo letto da foto: controlla il nome");
    } else {
      nameConf = fc(nameConf.score * 0.88, `${nameConf.reason} (da foto)`);
    }
  }

  // ---- category -----------------------------------------------------------
  let category: ImportCategory;
  let catConf: FieldConfidence;
  if (hint?.category) {
    category = hint.category;
    catConf = fc(0.97, "Categoria corretta in un import precedente");
  } else if (extra.cellCategory) {
    const g = classifyCategory(name, extra.cellCategory);
    category = g.category;
    catConf = fc(Math.max(g.confidence, 0.85), "Categoria indicata nel file");
  } else {
    const g = classifyCategory(name, extra.sectionCategory);
    category = g.category;
    catConf = fc(g.confidence, g.reason);
    if (g.confidence < 0.6 && ctx.knownIndex) {
      const m = ctx.knownIndex.best(name, 0.62);
      if (m && m.item.category !== "altro") {
        category = m.item.category;
        catConf = fc(0.5 + 0.4 * m.score, `Simile a «${m.item.name}»`);
      }
    }
  }

  // ---- price --------------------------------------------------------------
  let price = parsed.price;
  let priceConf = fc(parsed.priceScore, parsed.priceReason);
  if (extra.cellPrice) {
    price = extra.cellPrice.value;
    priceConf = fc(extra.cellPrice.score, extra.cellPrice.reason);
    const i = issues.indexOf("Prezzo non trovato");
    if (i >= 0) issues.splice(i, 1);
  }
  if (price === null) {
    priceConf = fc(0, "Prezzo non trovato");
    if (!issues.includes("Prezzo non trovato")) issues.push("Prezzo non trovato");
  } else if (price > 5000) {
    priceConf = fc(Math.min(priceConf.score, 0.4), "Prezzo insolitamente alto");
    issues.push("Prezzo molto alto: è davvero corretto?");
  }

  // ---- unit the price refers to -------------------------------------------
  const pack = parsed.pack;
  let priceUnit: SaleUnit;
  let unitConf: FieldConfidence;
  if (hint?.priceUnit) {
    priceUnit = hint.priceUnit;
    unitConf = fc(0.97, "Unità corretta in un import precedente");
  } else if (parsed.priceBasis) {
    priceUnit = parsed.priceBasis;
    unitConf = fc(0.95, `Prezzo indicato “al ${SALE_UNIT_LABELS[priceUnit]}”`);
  } else if (extra.tableUnit) {
    const tu = extra.tableUnit;
    const mb = measureBase(tu);
    const soldByWeight = ["carne", "pesce", "latticini", "verdura", "frutta"].includes(category);
    // "1,5/2 kg", "7 kg ca." describe the piece weight, not a pack
    const approximate = /\d\s*\/\s*\d|\bca\.?(?:\s|$)|circa|±|~|\bmedi[oa]\b/i.test(extra.original);
    if ((mb === "kg" || mb === "l") && pack.total?.base === mb && pack.total.value >= 2 && !soldByWeight && !approximate) {
      // "UM: LT · Conf.: 5 lt · 47,50" — dry goods are priced per pack.
      priceUnit = pack.container ?? "confezione";
      unitConf = fc(0.6, `Colonna unità “${SALE_UNIT_LABELS[tu]}” ma confezione da ${parsed.format}: prezzo per confezione`);
      issues.push(`Verifica: prezzo al ${SALE_UNIT_LABELS[tu]} o per la confezione da ${parsed.format}?`);
    } else if (tu === "confezione" && pack.container && pack.container !== "confezione") {
      // "SC"/"CF" are generic ("scatola", "confezione"): the pack cell is more specific ("sacco 25 kg").
      priceUnit = pack.container;
      unitConf = fc(0.88, `Colonna unità “${SALE_UNIT_LABELS[tu]}”, confezione “${SALE_UNIT_LABELS[pack.container]}”`);
    } else {
      priceUnit = tu;
      unitConf = fc(0.9, `Colonna unità: ${SALE_UNIT_LABELS[priceUnit]}`);
    }
  } else if (extra.headerBasis) {
    priceUnit = extra.headerBasis;
    unitConf = fc(0.88, `Intestazione prezzo: al ${SALE_UNIT_LABELS[priceUnit]}`);
  } else if (parsed.loneUnit) {
    priceUnit = parsed.loneUnit;
    unitConf = fc(0.85, `Unità “${SALE_UNIT_LABELS[priceUnit]}” sulla riga`);
  } else if (pack.container && (pack.container === "latta" || pack.container === "bottiglia") && (pack.pieces ?? 1) > 1) {
    // "lattina 33 cl x 24", "bottiglia 75 cl x 6": the price is for the pack, not one can
    priceUnit = "confezione";
    unitConf = fc(0.75, `Prezzo per confezione da ${pack.pieces} ${SALE_UNIT_LABELS[pack.container]}`);
  } else if (pack.container) {
    priceUnit = pack.container;
    unitConf = fc(0.8, `Prezzo riferito a ${SALE_UNIT_LABELS[priceUnit]}`);
  } else if (pack.pieceSize) {
    const big = pack.pieceSize.value * (pack.pieces ?? 1) >= 2;
    priceUnit = pack.pieces && pack.pieces > 1 ? "confezione" : big ? "confezione" : "pz";
    unitConf = fc(0.72, parsed.format ? `Prezzo per ${priceUnit === "pz" ? "pezzo" : "confezione"} da ${parsed.format}` : "Prezzo per pezzo");
  } else if (pack.pieces && pack.pieces > 1) {
    priceUnit = "confezione";
    unitConf = fc(0.65, `Prezzo per confezione da ${pack.pieces} pz`);
  } else {
    const d = defaultPriceUnit(category);
    priceUnit = d.unit;
    unitConf = fc(d.score, d.reason);
    issues.push(d.unit === "kg" ? "Unità non indicata: assunto prezzo al kg" : "Unità non indicata: assunto prezzo al pezzo");
  }

  const unitPrice = price !== null ? computeUnitPrice(price, priceUnit, pack) : null;
  // A per-kg price under a container with no weight cannot be compared: say so.
  if (price !== null && isContainer(priceUnit) && !pack.total && priceUnit !== "mazzo" && priceUnit !== "rotolo") {
    issues.push(`Contenuto del ${SALE_UNIT_LABELS[priceUnit]} non indicato`);
    unitConf = fc(Math.min(unitConf.score, 0.7), unitConf.reason);
  }

  // ---- overall ------------------------------------------------------------
  let overall = 0.4 * priceConf.score + 0.27 * nameConf.score + 0.2 * unitConf.score + 0.13 * catConf.score;
  if (priceConf.score < 0.5 || nameConf.score < 0.5) overall = Math.min(overall, 0.45);
  if (fromMemory) overall = Math.max(overall, Math.min(0.95, overall + 0.15));
  overall = Math.round(overall * 100) / 100;

  if (catConf.score < 0.4) issues.push(`Categoria incerta (${CATEGORY_LABELS[category]})`);

  return {
    id: extra.id,
    original: extra.original,
    sourceKey,
    name,
    format: parsed.format,
    code: extra.code ?? parsed.code,
    brand: extra.brand ?? parsed.brand,
    category,
    section: extra.section,
    price,
    priceUnit,
    pack,
    unitPrice,
    vatRate: extra.vatRate ?? parsed.vatRate,
    minQty: extra.minQty ?? parsed.minQty,
    availability: extra.availability ?? parsed.availability,
    available: parsed.available && !/esaurit|non\s+disponibil|terminat/i.test(extra.availability ?? ""),
    origin: extra.origin ?? parsed.origin,
    confidence: { overall, name: nameConf, price: priceConf, unit: unitConf, category: catConf },
    issues: [...new Set(issues)],
    fromMemory,
    mergedCount: 0,
  };
}
