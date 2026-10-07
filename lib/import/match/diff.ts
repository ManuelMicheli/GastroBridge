// Price-list diff: what changes when an existing list is updated.

import { nameKey } from "../text.ts";
import { unitFromWord } from "../parse/units.ts";
import { NameIndex } from "./similarity.ts";

export type ExistingItem = { id: string; name: string; unit: string; price: number; available?: boolean };
export type IncomingItem = { key: string; name: string; unit: string; price: number };

export type DiffKind = "new" | "increased" | "decreased" | "unchanged" | "removed";

export type DiffEntry = {
  kind: DiffKind;
  incoming: IncomingItem | null;
  existing: ExistingItem | null;
  /** incoming − existing */
  delta: number | null;
  /** relative change, e.g. 0.12 = +12 % */
  pct: number | null;
  /** How the two were matched. */
  match: "exact" | "name" | "fuzzy" | null;
  matchScore: number | null;
  unitChanged: boolean;
};

export type DiffSummary = {
  entries: DiffEntry[];
  counts: Record<DiffKind, number>;
  /** incoming key → matched existing id */
  matches: Record<string, string>;
};

export function normalizeUnitKey(u: string): string {
  const su = unitFromWord(u.split(/\s+/)[0] ?? u);
  if (su === "g" || su === "hg") return "kg";
  if (su === "cl" || su === "ml") return "l";
  return su ?? nameKey(u);
}

const EPS = 0.005;

export function diffPriceLists(
  existing: ExistingItem[],
  incoming: IncomingItem[],
  opts: { fuzzyThreshold?: number } = {},
): DiffSummary {
  const fuzzyThreshold = opts.fuzzyThreshold ?? 0.82;
  const used = new Set<string>();
  const entries: DiffEntry[] = [];
  const matches: Record<string, string> = {};

  const exact = new Map<string, ExistingItem>();
  const byName = new Map<string, ExistingItem[]>();
  for (const e of existing) {
    const k = `${nameKey(e.name)}|${normalizeUnitKey(e.unit)}`;
    if (!exact.has(k)) exact.set(k, e);
    const nk = nameKey(e.name);
    byName.set(nk, [...(byName.get(nk) ?? []), e]);
  }
  const index = new NameIndex(existing, (e) => e.name);

  const resolve = (inc: IncomingItem): { e: ExistingItem; how: DiffEntry["match"]; score: number } | null => {
    const ek = exact.get(`${nameKey(inc.name)}|${normalizeUnitKey(inc.unit)}`);
    if (ek && !used.has(ek.id)) return { e: ek, how: "exact", score: 1 };
    const sameName = (byName.get(nameKey(inc.name)) ?? []).find((e) => !used.has(e.id));
    if (sameName) return { e: sameName, how: "name", score: 0.95 };
    const fz = index.best(inc.name, fuzzyThreshold);
    if (fz && !used.has(fz.item.id) && normalizeUnitKey(fz.item.unit) === normalizeUnitKey(inc.unit)) {
      return { e: fz.item, how: "fuzzy", score: fz.score };
    }
    return null;
  };

  for (const inc of incoming) {
    const r = resolve(inc);
    if (!r) {
      entries.push({ kind: "new", incoming: inc, existing: null, delta: null, pct: null, match: null, matchScore: null, unitChanged: false });
      continue;
    }
    used.add(r.e.id);
    matches[inc.key] = r.e.id;
    const delta = Math.round((inc.price - r.e.price) * 100) / 100;
    const kind: DiffKind = Math.abs(delta) < EPS ? "unchanged" : delta > 0 ? "increased" : "decreased";
    entries.push({
      kind,
      incoming: inc,
      existing: r.e,
      delta,
      pct: r.e.price > 0 ? Math.round((delta / r.e.price) * 1000) / 1000 : null,
      match: r.how,
      matchScore: Math.round(r.score * 100) / 100,
      unitChanged: normalizeUnitKey(inc.unit) !== normalizeUnitKey(r.e.unit),
    });
  }
  for (const e of existing) {
    if (!used.has(e.id)) {
      entries.push({ kind: "removed", incoming: null, existing: e, delta: null, pct: null, match: null, matchScore: null, unitChanged: false });
    }
  }
  const counts: Record<DiffKind, number> = { new: 0, increased: 0, decreased: 0, unchanged: 0, removed: 0 };
  for (const en of entries) counts[en.kind]++;
  return { entries, counts, matches };
}
