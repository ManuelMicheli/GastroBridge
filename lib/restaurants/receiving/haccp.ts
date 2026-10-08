// HACCP traceability rules (client + server safe, no I/O).
// Reg. CE 178/2002 art. 18: the restaurant must be able to tell, for every
// food it received, from whom, when, and (for the traced categories) which lot.

import { inferCategory, MACRO_CATEGORY_LABELS, type MacroCategory } from "@/lib/analytics/category-keywords";

export type TempRule = { min?: number | null; max?: number | null };

export type HaccpSettings = {
  tracedCategories: MacroCategory[];
  tracedKeywords: string[];
  temperatureRules: Partial<Record<MacroCategory, TempRule>>;
  requireDdtPhoto: boolean;
};

/** Same defaults as the restaurant_haccp_settings column defaults. */
export const DEFAULT_HACCP_SETTINGS: HaccpSettings = {
  tracedCategories: ["carne", "pesce", "latticini", "surgelati"],
  tracedKeywords: ["uova", "uovo"],
  temperatureRules: {
    carne: { min: 0, max: 4 },
    pesce: { min: 0, max: 2 },
    latticini: { min: 0, max: 4 },
    surgelati: { max: -18 },
  },
  requireDdtPhoto: false,
};

export const HACCP_CATEGORIES: MacroCategory[] = [
  "carne",
  "pesce",
  "latticini",
  "surgelati",
  "verdura",
  "frutta",
  "panetteria",
  "secco",
  "bevande",
  "altro",
];

export { MACRO_CATEGORY_LABELS };
export type { MacroCategory };

const KNOWN = new Set<string>(HACCP_CATEGORIES);

export function toMacroCategory(raw: string | null | undefined, name: string): MacroCategory {
  if (raw && KNOWN.has(raw)) return raw as MacroCategory;
  return inferCategory(name);
}

/** Lot + expiry (+ temperature when a rule exists) are asked for this line. */
export function isTraced(name: string, category: MacroCategory, s: HaccpSettings): boolean {
  if (s.tracedCategories.includes(category)) return true;
  const lc = name.toLowerCase();
  return s.tracedKeywords.some((k) => k && lc.includes(k.toLowerCase()));
}

export function temperatureRule(category: MacroCategory, s: HaccpSettings): TempRule | null {
  const r = s.temperatureRules[category];
  if (!r) return null;
  const hasMin = typeof r.min === "number";
  const hasMax = typeof r.max === "number";
  return hasMin || hasMax ? r : null;
}

/** true = in range, false = out of range, null = no rule / no reading. */
export function temperatureOk(category: MacroCategory, temp: number | null, s: HaccpSettings): boolean | null {
  if (temp === null || !Number.isFinite(temp)) return null;
  const r = temperatureRule(category, s);
  if (!r) return null;
  if (typeof r.min === "number" && temp < r.min) return false;
  if (typeof r.max === "number" && temp > r.max) return false;
  return true;
}

export function ruleLabel(r: TempRule | null): string {
  if (!r) return "";
  const hasMin = typeof r.min === "number";
  const hasMax = typeof r.max === "number";
  if (hasMin && hasMax) return `${r.min}…${r.max} °C`;
  if (hasMax) return `≤ ${r.max} °C`;
  if (hasMin) return `≥ ${r.min} °C`;
  return "";
}

/** Parse the DB row (tolerates partial / legacy JSON). */
export function settingsFromRow(row: {
  traced_categories?: string[] | null;
  traced_keywords?: string[] | null;
  temperature_rules?: Record<string, { min?: number | null; max?: number | null }> | null;
  require_ddt_photo?: boolean | null;
} | null): HaccpSettings {
  if (!row) return DEFAULT_HACCP_SETTINGS;
  const rules: HaccpSettings["temperatureRules"] = {};
  for (const [k, v] of Object.entries(row.temperature_rules ?? {})) {
    if (!KNOWN.has(k) || !v) continue;
    rules[k as MacroCategory] = {
      min: typeof v.min === "number" ? v.min : null,
      max: typeof v.max === "number" ? v.max : null,
    };
  }
  return {
    tracedCategories: (row.traced_categories ?? []).filter((c): c is MacroCategory => KNOWN.has(c)),
    tracedKeywords: (row.traced_keywords ?? []).map((k) => k.trim()).filter(Boolean),
    temperatureRules: rules,
    requireDdtPhoto: !!row.require_ddt_photo,
  };
}
