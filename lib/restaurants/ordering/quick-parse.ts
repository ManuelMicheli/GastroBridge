// Free-text shopping list → structured lines ("2 kg datterini, 1 cassa limoni").
// Deterministic and synchronous. Pure module (node --test friendly).
//
// TODO(ai-parsing): messy dictations / photos of handwritten lists could be
// parsed by the shared Claude client that the import agent is building in
// lib/ai/import. Do NOT add a second client here: when that module exposes a
// generic "parse shopping list" helper, call it from the Ordine veloce page as
// a fallback for the lines `parseShoppingList` leaves with `confidence: "low"`.

import { normalizeUnit } from "../../catalogs/normalize.ts";

export type ParsedLine = {
  /** Original text of the line. */
  raw: string;
  /** Quantity requested (1 when not written). */
  qty: number;
  /** True when the cook wrote a quantity. */
  explicitQty: boolean;
  /** Canonical unit (kg, g, l, pz, cassa, cartone, cf, bottiglia, …) or null. */
  unit: string | null;
  /** Product text left once quantity and unit are removed. */
  text: string;
  confidence: "high" | "low";
};

const NUMBER_WORDS: Record<string, number> = {
  mezzo: 0.5, mezza: 0.5, un: 1, uno: 1, una: 1, "un'": 1, due: 2, tre: 3,
  quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  undici: 11, dodici: 12, quindici: 15, venti: 20, trenta: 30, dozzina: 12,
  paio: 2,
};

// Unit words a cook writes, mapped to the canonical unit.
const UNIT_WORDS: Record<string, string> = {
  kg: "kg", kili: "kg", kilo: "kg", chili: "kg", chilo: "kg", chilogrammi: "kg", kilogrammi: "kg",
  g: "g", gr: "g", grammi: "g",
  hg: "hg", etto: "hg", etti: "hg",
  l: "l", lt: "l", litro: "l", litri: "l",
  ml: "ml", cl: "cl",
  pz: "pz", pezzo: "pz", pezzi: "pz", n: "pz", nr: "pz",
  cassa: "cassa", casse: "cassa", cassetta: "cassa", cassette: "cassa",
  cartone: "cartone", cartoni: "cartone", ct: "cartone",
  confezione: "cf", confezioni: "cf", conf: "cf", cf: "cf", pacco: "cf", pacchi: "cf",
  busta: "busta", buste: "busta", sacco: "sacco", sacchi: "sacco",
  vaschetta: "vaschetta", vaschette: "vaschetta",
  bottiglia: "bottiglia", bottiglie: "bottiglia",
  latta: "latta", lattine: "latta", barattolo: "barattolo", barattoli: "barattolo",
  vasetto: "vasetto", vasetti: "vasetto", mazzo: "mazzo", mazzi: "mazzo",
  fardello: "fardello", fardelli: "fardello", forma: "forma", forme: "forma",
  testa: "pz", teste: "pz", cespo: "pz", cespi: "pz",
};

const FILLERS = new Set(["di", "da", "del", "della", "dei", "delle", "x"]);

function toNumber(tok: string): number | null {
  const t = tok.replace(",", ".").replace(/^x/, "").replace(/x$/, "");
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b ? a! / b : null;
  }
  if (t === "½") return 0.5;
  return NUMBER_WORDS[t] ?? null;
}

function cleanToken(tok: string): string {
  return tok.toLowerCase().replace(/[.:;]+$/, "");
}

/** Split a free-text list into one entry per line / comma / semicolon / bullet. */
export function splitShoppingList(text: string): string[] {
  return text
    .split(/\r?\n|;|,(?!\d)|•|·/)
    .map((s) => s.replace(/^\s*[-*–—]\s*/, "").trim())
    .filter((s) => s.length > 0);
}

/** Parse one line: leading or trailing quantity + optional unit + product. */
export function parseLine(raw: string): ParsedLine | null {
  // "2kg" → "2 kg", "x6" stays a token, "1,5kg" → "1,5 kg"
  const spaced = raw
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return null;
  const toks = spaced.split(" ");

  let qty: number | null = null;
  let unit: string | null = null;
  let start = 0;
  let end = toks.length;

  // Leading quantity ("2", "una", "mezzo", "2x")
  const lead = toNumber(cleanToken(toks[0]!));
  if (lead !== null && toks.length > 1) {
    qty = lead;
    start = 1;
    // "un paio di", "una dozzina di"
    const next = cleanToken(toks[start] ?? "");
    if (NUMBER_WORDS[next] !== undefined && (next === "dozzina" || next === "paio")) {
      qty = qty * NUMBER_WORDS[next]!;
      start += 1;
    }
    const u = UNIT_WORDS[cleanToken(toks[start] ?? "")];
    if (u) {
      unit = u;
      start += 1;
    }
  }

  // Trailing quantity ("datterini 2 kg", "limoni x2", "mozzarelle 3")
  if (qty === null && toks.length > 1) {
    const last = cleanToken(toks[end - 1]!);
    const lastUnit = UNIT_WORDS[last];
    if (lastUnit && end - 2 >= 1) {
      const n = toNumber(cleanToken(toks[end - 2]!));
      if (n !== null) {
        qty = n;
        unit = lastUnit;
        end -= 2;
      }
    } else {
      const n = toNumber(last);
      if (n !== null && /\d/.test(last)) {
        qty = n;
        end -= 1;
        const maybeX = cleanToken(toks[end - 1] ?? "");
        if (maybeX === "x" && end - 1 >= 1) end -= 1;
      }
    }
  }

  // Drop fillers between quantity/unit and product ("2 kg di datterini").
  while (start < end && FILLERS.has(cleanToken(toks[start]!))) start += 1;

  const text = toks.slice(start, end).join(" ").trim();
  if (!text) return null;
  const explicitQty = qty !== null && qty > 0;
  return {
    raw: raw.trim(),
    qty: explicitQty ? qty! : 1,
    explicitQty,
    unit: unit ? normalizeUnit(unit) : null,
    text,
    confidence: text.length >= 3 ? "high" : "low",
  };
}

export function parseShoppingList(text: string): ParsedLine[] {
  return splitShoppingList(text)
    .map(parseLine)
    .filter((l): l is ParsedLine => l !== null)
    .slice(0, 80);
}
