// Order lines ("10 kg farina 00", "olio evo x 6", "pomodori: 3 casse")
// from any SourceDoc — used by the "ordine tipico" import in Cerca.

import type { SourceDoc } from "../types.ts";
import { cleanLine, fold, stripChatPrefix } from "../text.ts";
import { parseNumber } from "../parse/numbers.ts";
import { unitFromWord } from "../parse/units.ts";
import { detectHeader, inferRolesFromContent } from "./table.ts";
import { isNoiseText } from "../lexicon/misc.ts";

export type OrderLine = { name: string; qty: number; unit: string | null; raw: string };

const UNIT_WORDS =
  "kg|kgs|kili|chili|g|gr|grammi|hg|etti|l|lt|litri|cl|ml|pz|pezzi|pezzo|n|nr|cartoni|cartone|crt|ct|casse|cassa|cassette|conf|confezioni|confezione|cf|sacchi|sacco|buste|busta|vaschette|vaschetta|bottiglie|bottiglia|btg|latte|latta|lattine|fusti|fusto|mazzi|mazzo|vassoi|vassoio|pacchi|pacco|scatole|scatola|forme|forma|teglie|teglia|rotoli|rotolo";

const LEADING = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*(${UNIT_WORDS})?\.?\s*(?:x|di|de|d'|da)?\s+(.{2,})$`, "i");
const TRAILING = new RegExp(String.raw`^(.{2,}?)\s*(?:[:\-–=x×]|\bper\b|\bqta\.?|\bq\.tà)?\s*(\d+(?:[.,]\d+)?)\s*(${UNIT_WORDS})?\.?$`, "i");

function unitLabel(u: string | undefined): string | null {
  if (!u) return null;
  const su = unitFromWord(u);
  if (su) return su === "l" ? "lt" : su;
  return fold(u);
}

/** Parse one free-text order line; null when there is no quantity. */
export function parseOrderLine(input: string): OrderLine | null {
  const raw = stripChatPrefix(input).text;
  const t = cleanLine(raw).replace(/\s{2,}/g, " ");
  if (!t || isNoiseText(t)) return null;
  const lead = LEADING.exec(t);
  if (lead) {
    const qty = parseNumber(lead[1]!);
    if (qty && qty > 0 && /[a-zà-ú]{2}/i.test(lead[3]!)) {
      return { name: lead[3]!.trim(), qty, unit: unitLabel(lead[2]), raw: t };
    }
  }
  const trail = TRAILING.exec(t);
  if (trail) {
    const qty = parseNumber(trail[2]!);
    const name = trail[1]!.trim().replace(/[:\-–=]+$/, "").trim();
    // "Farina 00" → the number is part of the name, not a quantity
    if (qty && qty > 0 && /[a-zà-ú]{2}/i.test(name) && !/^0\d/.test(trail[2]!)) {
      return { name, qty, unit: unitLabel(trail[3]), raw: t };
    }
  }
  return null;
}

/** Order lines from a whole document (tables use a quantity column). */
export function parseOrderLines(doc: SourceDoc): { lines: OrderLine[]; skipped: number } {
  const lines: OrderLine[] = [];
  let skipped = 0;
  for (const sheet of doc.sheets) {
    if (sheet.layout !== "text") {
      const header = detectHeader(sheet.rows);
      const data = sheet.rows.slice((header?.index ?? -1) + 1);
      const roles = { ...(header?.roles ?? {}) };
      // a header-less sheet: text column = name, integer-ish column = qty
      const inferred = inferRolesFromContent(data.slice(0, 200), roles).roles;
      const nameCol = Number(Object.entries(inferred).find(([, r]) => r === "name")?.[0] ?? -1);
      let qtyCol = Number(Object.entries(roles).find(([, r]) => r === "qty")?.[0] ?? -1);
      if (qtyCol < 0) qtyCol = Number(Object.entries(inferred).find(([, r]) => r === "price" || r === "qty")?.[0] ?? -1);
      const unitCol = Number(Object.entries(inferred).find(([, r]) => r === "unit")?.[0] ?? -1);
      if (nameCol >= 0 && qtyCol >= 0) {
        for (const r of data) {
          const name = (r[nameCol] ?? "").trim();
          const qty = parseNumber((r[qtyCol] ?? "").trim());
          if (!name || !qty || qty <= 0) {
            if (r.some((c) => c && c.trim())) skipped++;
            continue;
          }
          lines.push({ name, qty, unit: unitCol >= 0 ? unitLabel(r[unitCol]) : null, raw: r.filter(Boolean).join(" · ") });
        }
        continue;
      }
    }
    for (const r of sheet.rows) {
      const text = r.filter(Boolean).join(" ");
      if (!text.trim()) continue;
      const l = parseOrderLine(text);
      if (l) lines.push(l);
      else skipped++;
    }
  }
  return { lines, skipped };
}
