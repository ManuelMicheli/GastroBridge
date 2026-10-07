// Import memory: learn from the user's corrections, re-apply them next time.

import type { ColumnRole, ExtractedProduct, ImportHints, ProductHint, SaleUnit, SupplierInfo } from "./types.ts";
import type { ImportCategory } from "./lexicon/categories.ts";
import { emptyHints } from "./types.ts";
import { fold, nameKey } from "./text.ts";
import { ABBREVIATIONS } from "./lexicon/abbreviations.ts";

const MAX_PRODUCTS = 3000;
const MAX_ABBREVIATIONS = 400;
const MAX_LAYOUTS = 20;

/** What the user confirmed for a product in the review screen. */
export type ReviewedProduct = {
  id: string;
  name: string;
  priceUnit: SaleUnit;
  category: ImportCategory;
  /** Excluded from the import by the user. */
  removed?: boolean;
};

export function normalizeHints(raw: unknown): ImportHints {
  const h = emptyHints();
  if (!raw || typeof raw !== "object") return h;
  const r = raw as Partial<ImportHints>;
  if (r.products && typeof r.products === "object") h.products = { ...r.products };
  if (r.abbreviations && typeof r.abbreviations === "object") h.abbreviations = { ...r.abbreviations };
  if (r.columnLayouts && typeof r.columnLayouts === "object") h.columnLayouts = { ...r.columnLayouts };
  if (r.supplier && typeof r.supplier === "object") h.supplier = { ...r.supplier };
  return h;
}

/** Merge several hint sets; later ones win. */
export function mergeHints(...all: Array<ImportHints | null | undefined>): ImportHints {
  const out = emptyHints();
  for (const h of all) {
    if (!h) continue;
    Object.assign(out.products, h.products);
    Object.assign(out.abbreviations, h.abbreviations);
    Object.assign(out.columnLayouts, h.columnLayouts);
    if (h.supplier) out.supplier = { ...(out.supplier ?? {}), ...h.supplier };
  }
  return out;
}

function isSubsequence(short: string, long: string): boolean {
  let i = 0;
  for (const ch of long) if (ch === short[i]) i++;
  return i === short.length;
}

/** Abbreviations the user expanded by hand: "pomd." + "Pomodori" → pomd → pomodori. */
export function learnAbbreviations(original: string, corrected: string): Record<string, string> {
  const learned: Record<string, string> = {};
  const correctedWords = fold(corrected).split(/[^a-z']+/).filter((w) => w.length >= 3);
  const rawTokens = original.split(/\s+/);
  for (const tok of rawTokens) {
    const m = /^([A-Za-zÀ-ú]{2,8})(\.?)$/.exec(tok.replace(/[,;:()]/g, ""));
    if (!m) continue;
    const stem = fold(m[1]!);
    const hadDot = m[2] === ".";
    const upperShort = m[1]!.length <= 4 && m[1] === m[1]!.toUpperCase();
    if (!hadDot && !upperShort) continue;
    if (ABBREVIATIONS[stem]) continue;
    if (correctedWords.includes(stem)) continue;
    // first corrected word that starts with the stem ("ross" → rossi), else one that
    // contains its letters in order ("pomd" → pomodori), else initials (fdl → fior di latte)
    const word =
      correctedWords.find((w) => w.startsWith(stem) && w.length > stem.length) ??
      correctedWords.find((w) => w[0] === stem[0] && w.length > stem.length + 1 && isSubsequence(stem, w));
    if (word) {
      learned[stem] = word;
      continue;
    }
    if (upperShort && stem.length >= 2) {
      const words = fold(corrected).split(/\s+/);
      for (let i = 0; i + stem.length <= words.length; i++) {
        const slice = words.slice(i, i + stem.length);
        if (slice.map((w) => w[0]).join("") === stem) {
          learned[stem] = slice.join(" ");
          break;
        }
      }
    }
  }
  return learned;
}

/**
 * Build the hints to store after an import, from what was extracted and what
 * the user finally confirmed. Only actual corrections are remembered.
 */
/** One product as extracted (before) and as confirmed by the user (after). */
export type Correction = {
  sourceKey: string;
  original: string;
  before: { name: string; priceUnit: SaleUnit; category: ImportCategory };
  after: { name: string; priceUnit: SaleUnit; category: ImportCategory };
  removed?: boolean;
};

export type LearnExtra = {
  supplier?: Partial<SupplierInfo>;
  layouts?: Array<{ signature: string; roles: Record<number, ColumnRole> }>;
};

export function learnFromReview(
  previous: ImportHints | null,
  extracted: ExtractedProduct[],
  reviewed: ReviewedProduct[],
  extra: LearnExtra = {},
): { hints: ImportHints; learnedCount: number } {
  const byId = new Map(extracted.map((p) => [p.id, p]));
  const corrections: Correction[] = [];
  for (const r of reviewed) {
    const p = byId.get(r.id);
    if (!p) continue;
    corrections.push({
      sourceKey: p.sourceKey,
      original: p.original,
      before: { name: p.name, priceUnit: p.priceUnit, category: p.category },
      after: { name: r.name, priceUnit: r.priceUnit, category: r.category },
      removed: r.removed,
    });
  }
  return learnFromCorrections(previous, corrections, extra);
}

/**
 * Build the hints to store after an import. Only actual corrections are
 * remembered; untouched products leave no trace.
 */
export function learnFromCorrections(
  previous: ImportHints | null,
  corrections: Correction[],
  extra: LearnExtra = {},
): { hints: ImportHints; learnedCount: number } {
  const hints = mergeHints(previous);
  let learnedCount = 0;

  for (const c of corrections) {
    if (!c.sourceKey) continue;
    const hint: ProductHint = { ...(hints.products[c.sourceKey] ?? {}) };
    let changed = false;
    if (c.removed) {
      if (!hint.ignore) {
        hint.ignore = true;
        changed = true;
      }
    } else {
      if (hint.ignore) {
        delete hint.ignore;
        changed = true;
      }
      if (nameKey(c.after.name) !== nameKey(c.before.name)) {
        hint.name = c.after.name.trim();
        changed = true;
        const ab = learnAbbreviations(c.original, c.after.name);
        for (const [k, v] of Object.entries(ab)) hints.abbreviations[k] = v;
      }
      if (c.after.priceUnit !== c.before.priceUnit) {
        hint.priceUnit = c.after.priceUnit;
        changed = true;
      }
      if (c.after.category !== c.before.category) {
        hint.category = c.after.category;
        changed = true;
      }
    }
    if (changed) {
      hints.products[c.sourceKey] = hint;
      learnedCount++;
    }
  }

  for (const l of extra.layouts ?? []) {
    if (l.signature) hints.columnLayouts[l.signature] = l.roles;
  }

  if (extra.supplier) {
    const s = extra.supplier;
    hints.supplier = {
      ...(hints.supplier ?? {}),
      ...(s.name ? { name: s.name } : {}),
      ...(s.vatNumber ? { vatNumber: s.vatNumber } : {}),
      ...(s.emails?.length ? { emails: s.emails } : {}),
      ...(s.phones?.length ? { phones: s.phones } : {}),
      ...(s.address ? { address: s.address } : {}),
      ...(s.deliveryDays?.length ? { deliveryDays: s.deliveryDays } : {}),
      ...(s.minOrder != null ? { minOrder: s.minOrder } : {}),
      ...(s.leadTimeDays != null ? { leadTimeDays: s.leadTimeDays } : {}),
    };
  }

  // Bound the size of what we store.
  const pk = Object.keys(hints.products);
  if (pk.length > MAX_PRODUCTS) for (const k of pk.slice(0, pk.length - MAX_PRODUCTS)) delete hints.products[k];
  const ak = Object.keys(hints.abbreviations);
  if (ak.length > MAX_ABBREVIATIONS) for (const k of ak.slice(0, ak.length - MAX_ABBREVIATIONS)) delete hints.abbreviations[k];
  const lk = Object.keys(hints.columnLayouts);
  if (lk.length > MAX_LAYOUTS) for (const k of lk.slice(0, lk.length - MAX_LAYOUTS)) delete hints.columnLayouts[k];

  return { hints, learnedCount };
}

/** Memory keys for a supplier as seen by a restaurant (most specific first). */
export function supplierMemoryKeys(s: { vatNumber?: string | null; name?: string | null }, catalogId?: string | null): string[] {
  const keys: string[] = [];
  if (catalogId) keys.push(`catalog:${catalogId}`);
  if (s.vatNumber) keys.push(`piva:${s.vatNumber}`);
  if (s.name) {
    const k = nameKey(s.name)
      .replace(/\b(s ?r ?l|s ?p ?a|s ?n ?c|s ?a ?s|srls)\b/g, "")
      .trim();
    if (k) keys.push(`name:${k}`);
  }
  return keys;
}
