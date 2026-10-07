// Parse one product description ("POMOD. DATT. CRT 5KG € 14,50") into fields.

import type { ImportCategory } from "../lexicon/categories.ts";
import type { PackInfo, SaleUnit } from "../types.ts";
import { cleanLine } from "../text.ts";
import { findMoney, findVat, parseNumber, type MoneyCandidate } from "../parse/numbers.ts";
import { parsePack, unitFromWord, type Span } from "../parse/units.ts";
import { findAvailability, findBrand, findOrigin } from "../lexicon/misc.ts";

export type ParsedText = {
  /** Cleaned input line. */
  text: string;
  /** Remaining name text (before abbreviation expansion). */
  nameRaw: string;
  code: string | null;
  brand: string | null;
  price: number | null;
  priceScore: number;
  priceReason: string;
  /** Unit explicitly tied to the price ("€/kg", "al kg", "cad", "kg 1,80"). */
  priceBasis: SaleUnit | null;
  /** Unit token found alone in the line ("KG"). */
  loneUnit: SaleUnit | null;
  pack: PackInfo;
  format: string | null;
  vatRate: number | null;
  vatIncluded: boolean | null;
  minQty: { value: number; unit: SaleUnit | null } | null;
  availability: string | null;
  available: boolean;
  origin: string | null;
  /** Other money amounts on the line (not chosen). */
  otherPrices: number[];
  issues: string[];
};

const UNIT_WORD_ALT =
  "kg|kgs|kilo|chil[oi]|grammi|gr|g|hg|etto|litri|litro|lt|l|cl|ml|pz|pezzo|pezzi|cad|cadauno|cadauna|cartone|cartoni|crt|ct|cassa|casse|cassetta|conf|confezione|cf|sacco|busta|vaschetta|vasch|secchio|latta|lattina|bottiglia|btg|fusto|vassoio|mazzo|mazzi|pallet|rotolo|collo|colli";

const MIN_QTY_RE = new RegExp(
  String.raw`\b(?:min(?:imo)?\.?|ordine\s+min(?:imo)?\.?|moq|q\.?\s?t[aà]\.?\s+min(?:ima)?\.?)\s*[:.]?\s*(?:d['i]\s*)?(\d+(?:[.,]\d+)?)\s*(${UNIT_WORD_ALT})?\b\.?`,
  "i",
);

const NOT_PRICE_AFTER = /^\s*(?:%|mesi|mese|anni|anno|gg|giorni|gradi|°|cm|mm|m\b|pezzi\s+per|kcal|cal\b|ore\b|h\b|x\b|°c)/i;
const NOT_PRICE_BEFORE = /(?:\bn\.?|n°|\bnr\.?|\bnum\.?|\bcat\.?|\bcal\.?|\bcalibro|\btipo|\bt\.|\bformato|\bmisura|\bart\.?|\bcod\.?|\blotto|\bdim\.?|\bø|#)\s*$/i;

const LEADING_CODE_RE = /^\s*(?:cod(?:ice)?\.?\s*(?:art(?:icolo)?\.?)?\s*[:.]?\s*)?([A-Z]{0,5}[-./]?\d[\dA-Z\-./]*)\s+(?=\S)/i;
const ANY_CODE_RE = /\b(?:cod(?:ice)?\.?\s*(?:art\.?)?|art\.|rif\.|sku|ean)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-./]{2,20})/i;
const EAN_RE = /(?<![\d,.])(\d{13}|\d{8})(?![\d,.])/;

function maskSpans(text: string, spans: Span[], fill = " "): string {
  if (spans.length === 0) return text;
  const chars = text.split("");
  for (const s of spans) for (let i = s.start; i < s.end && i < chars.length; i++) chars[i] = fill;
  return chars.join("");
}

function overlapsAny(spans: Span[], s: number, e: number): boolean {
  return spans.some((x) => s < x.end && e > x.start);
}

function looksLikeQuantityToken(tok: string): boolean {
  if (/^\d+(?:[.,]\d+)?(?:kg|g|gr|hg|l|lt|ml|cl|pz|x\d+)$/i.test(tok)) return true;
  if (/^\d+x\d/i.test(tok)) return true;
  // 1–3 digits without leading zero → a count ("12 uova"), not a code
  if (/^[1-9]\d{0,2}$/.test(tok)) return true;
  return false;
}

/** Unit written right after or right before a money amount. */
function basisAround(text: string, c: MoneyCandidate): SaleUnit | null {
  const after = text.slice(c.end, c.end + 16);
  const a = new RegExp(String.raw`^\s*(?:€|eur(?:o)?)?\s*(?:/\s*|al\s+|alla\s+|a\s+|per\s+|il\s+|la\s+|x\s+|ogni\s+)?(${UNIT_WORD_ALT})\b`, "i").exec(after);
  if (a) {
    const u = unitFromWord(a[1]!);
    // "3,20 kg" without € or a connector is a weight, unless it ends the line
    if (u && (/€|eur|\/|al|alla|a |per|il|la|x|ogni/i.test(a[0]) || c.euro)) return u;
  }
  const before = text.slice(Math.max(0, c.start - 14), c.start);
  const b = new RegExp(String.raw`(?:^|\s)(${UNIT_WORD_ALT})\.?\s*(?:€|eur(?:o)?)?\s*[:=]?\s*$`, "i").exec(before);
  // "kg 18,90" is a price per kg; "25 kg 18,50" is a 25 kg pack priced 18,50.
  if (b && !/\d\s*$/.test(before.slice(0, b.index + (b[0].startsWith(" ") ? 1 : 0)))) return unitFromWord(b[1]!);
  return null;
}

export type ParseOptions = {
  /** Text came from OCR (lower trust). */
  ocr?: boolean;
  /** Price is given separately (table cell) — don't look for one in `text`. */
  noPrice?: boolean;
};

export function parseProductText(input: string, opts: ParseOptions = {}): ParsedText {
  const text = cleanLine(input);
  const issues: string[] = [];
  const masks: Span[] = [];

  // --- VAT ----------------------------------------------------------------
  let vatRate: number | null = null;
  let vatIncluded: boolean | null = null;
  const vat = findVat(text);
  if (vat) {
    vatRate = vat.rate;
    vatIncluded = vat.included;
    masks.push({ start: vat.start, end: vat.end });
  }

  // --- availability / origin / brand -------------------------------------
  let availability: string | null = null;
  let available = true;
  const av = findAvailability(maskSpans(text, masks));
  if (av) {
    availability = av.note;
    available = av.available;
    masks.push({ start: av.start, end: av.end });
  }
  let origin: string | null = null;
  const og = findOrigin(maskSpans(text, masks));
  if (og) {
    origin = og.origin;
    masks.push({ start: og.start, end: og.end });
  }
  const brandHit = findBrand(text);
  const brand = brandHit?.brand ?? null;

  // --- min quantity --------------------------------------------------------
  let minQty: ParsedText["minQty"] = null;
  {
    const m = MIN_QTY_RE.exec(maskSpans(text, masks));
    if (m && !/€|euro/i.test(text.slice(m.index, m.index + m[0].length + 2))) {
      const v = parseNumber(m[1]!);
      if (v !== null && v > 0) {
        minQty = { value: v, unit: m[2] ? unitFromWord(m[2]) : null };
        masks.push({ start: m.index, end: m.index + m[0].length });
      }
    }
  }

  // --- codes ---------------------------------------------------------------
  let code: string | null = null;
  {
    const masked = maskSpans(text, masks);
    const lead = LEADING_CODE_RE.exec(masked);
    if (lead && !looksLikeQuantityToken(lead[1]!) && /[a-zà-ú]{2}/i.test(masked.slice(lead[0].length))) {
      code = lead[1]!.replace(/[.\-/]$/, "");
      masks.push({ start: lead.index, end: lead.index + lead[0].length });
    } else {
      const any = ANY_CODE_RE.exec(masked);
      if (any) {
        code = any[1]!;
        masks.push({ start: any.index, end: any.index + any[0].length });
      } else {
        const ean = EAN_RE.exec(masked);
        if (ean) {
          code = ean[1]!;
          masks.push({ start: ean.index, end: ean.index + ean[0].length });
        }
      }
    }
  }

  // --- trailing "1,80 kg" with no other price → price per unit ------------
  let price: number | null = null;
  let priceScore = 0;
  let priceReason = "Prezzo non trovato";
  let priceBasis: SaleUnit | null = null;
  const otherPrices: number[] = [];

  if (!opts.noPrice) {
    const masked = maskSpans(text, masks);
    const euroCount = findMoney(masked).filter((c) => c.euro && c.value > 0).length;
    const tail = /(\d+[.,]\d{2})\s*(?:€\s*)?(?:\/\s*)?(kg|lt|l|pz|cad)\.?\s*$/i.exec(masked.trimEnd());
    const decimalsCount = (masked.match(/\d+[.,]\d{2}(?!\d)/g) ?? []).length;
    if (tail && euroCount === 0 && decimalsCount === 1) {
      const v = parseNumber(tail[1]!);
      if (v !== null && v > 0) {
        price = v;
        priceBasis = unitFromWord(tail[2]!);
        const weight = priceBasis === "kg" || priceBasis === "l";
        priceScore = weight ? 0.65 : 0.8;
        priceReason = `«${tail[0].trim()}» letto come prezzo al ${tail[2]!.toLowerCase()}`;
        if (weight) issues.push(`Verifica: «${tail[0].trim()}» interpretato come prezzo, non come peso`);
        masks.push({ start: tail.index, end: tail.index + tail[0].length });
      }
    }
  }

  // --- pack / size / basis -------------------------------------------------
  // Amounts with a € sign are prices, never sizes: hide them from the pack parser.
  const euroSpans: Span[] = opts.noPrice
    ? []
    : findMoney(maskSpans(text, masks))
        .filter((c) => c.euro && c.value > 0)
        .map((c) => ({ start: c.start, end: c.end }));
  // "§" (not a space) so masked prices don't glue neighbours into one pack expression.
  const packParse = parsePack(maskSpans(maskSpans(text, masks), euroSpans, "§"));
  const packSpans = packParse.spans;

  // --- price ---------------------------------------------------------------
  if (!opts.noPrice && price === null) {
    const masked = maskSpans(text, [...masks]);
    const all = findMoney(masked).filter((c) => {
      if (!(c.value > 0)) return false;
      if (overlapsAny(packSpans, c.start, c.end)) return false;
      if (NOT_PRICE_AFTER.test(masked.slice(c.end, c.end + 8))) return false;
      if (NOT_PRICE_BEFORE.test(masked.slice(Math.max(0, c.start - 10), c.start))) return false;
      if (!c.euro && !c.decimals && Number.isInteger(c.value) && c.value >= 1900 && c.value <= 2100) return false;
      return true;
    });
    // When a pack regex swallowed a euro amount, prefer the euro reading.
    const euro = all.filter((c) => c.euro);
    const dec = all.filter((c) => !c.euro && c.decimals && !c.spoken);
    const spoken = all.filter((c) => c.spoken);
    const ints = all.filter((c) => !c.euro && !c.decimals && !c.spoken && !overlapsAny(packSpans, c.start, c.end));

    let chosen: MoneyCandidate | null = null;
    if (euro.length > 0) {
      chosen = euro[0]!;
      priceScore = 0.95;
      priceReason = "Prezzo con simbolo €";
    } else if (dec.length > 0) {
      chosen = dec[dec.length - 1]!;
      priceScore = dec.length > 1 ? 0.75 : 0.85;
      priceReason = dec.length > 1 ? "Più importi sulla riga: preso l’ultimo" : "Importo con decimali";
    } else if (spoken.length > 0) {
      chosen = spoken[0]!;
      priceScore = 0.7;
      priceReason = `Prezzo scritto a parole (“${chosen.raw}”)`;
    } else if (ints.length > 0) {
      const last = ints[ints.length - 1]!;
      const rest = masked.slice(last.end).trim();
      // an integer is a price only at the end of the line (or before a unit/basis)
      if (!rest || /^(?:€|eur|euro|\/|al|a|cad|kg|pz|lt|l)\b/i.test(rest) || rest.length <= 3) {
        chosen = last;
        priceScore = 0.55;
        priceReason = "Numero intero a fine riga: probabilmente il prezzo";
        issues.push(`Prezzo senza decimali (${last.value}): controlla`);
      }
    }

    if (chosen) {
      price = chosen.value;
      masks.push({ start: chosen.start, end: chosen.end });
      priceBasis = basisAround(masked, chosen) ?? null;
      for (const c of [...euro, ...dec]) {
        if (c !== chosen && c.value !== chosen.value) otherPrices.push(c.value);
      }
      if (otherPrices.length > 0 && euro.length > 1) {
        priceScore = Math.min(priceScore, 0.8);
      }
    }
  }

  if (opts.ocr) priceScore = Math.round(priceScore * 0.9 * 100) / 100;

  // --- name ----------------------------------------------------------------
  const allSpans = [...masks, ...packSpans];
  let nameRaw = maskSpans(text, allSpans)
    .replace(/€|\beur(?:o)?\b/gi, " ")
    .replace(/\b(?:prezzo|cadauno|cad|iva|netto|lordo|cod\.?)\b\.?/gi, " ")
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/\s+[-–:|/+,;=]+(?=\s|$)/g, " ")
    .replace(/(?:^|\s)[-–:|/+,;=]+\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // dangling connectors left by removed pack/price text
  nameRaw = nameRaw
    .replace(/(?:\s+(?:al|alla|allo|a|da|di|per|il|la|x|in|ogni|e|con|Al|Alla|Da|Di|Per|X))+$/, "")
    .replace(/^(?:al|a|da|per|x)\s+/i, "")
    .replace(/[\s,;:\-–(]+$/g, "")
    .replace(/(?<=[\s\d])\.+$|^\.+/g, "")
    .replace(/^[\s,.;:\-–)]+/g, "")
    .trim();

  if (!opts.noPrice && price === null) issues.push("Prezzo non trovato");

  return {
    text,
    nameRaw,
    code,
    brand,
    price,
    priceScore,
    priceReason,
    priceBasis: priceBasis ?? packParse.basis,
    loneUnit: packParse.loneUnit,
    pack: packParse.pack,
    format: packParse.format,
    vatRate,
    vatIncluded,
    minQty,
    availability,
    available,
    origin,
    otherPrices,
    issues,
  };
}

/** Category-aware default unit when the line does not state one. */
export function defaultPriceUnit(category: ImportCategory): { unit: SaleUnit; score: number; reason: string } {
  if (category === "verdura" || category === "frutta") {
    return { unit: "kg", score: 0.6, reason: "Ortofrutta: prezzo assunto al kg" };
  }
  if (category === "carne" || category === "pesce") {
    return { unit: "kg", score: 0.5, reason: "Carne/pesce: prezzo assunto al kg" };
  }
  return { unit: "pz", score: 0.4, reason: "Unità non indicata: assunto il pezzo" };
}
