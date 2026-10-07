// Workspace appearance (accent preset + week start), persisted per device.
// The CSS presets live in the Fernly layer of app/globals.css; this module
// only knows their names. See docs/superpowers/specs/2026-10-07-fernly-style-redesign.md

export type AppArea = "restaurant" | "supplier";

export type AccentId = "bordeaux" | "forest" | "ocean" | "ambra" | "ocra";

export type AccentPreset = {
  id: AccentId;
  label: string;
  /** Swatch colours (deep + mid) for the picker. */
  swatch: [string, string];
};

export const ACCENT_PRESETS: Record<AccentId, AccentPreset> = {
  bordeaux: { id: "bordeaux", label: "Bordeaux", swatch: ["#6B1F2E", "#B91C3C"] },
  forest: { id: "forest", label: "Forest", swatch: ["#17523A", "#1F7A52"] },
  ocean: { id: "ocean", label: "Ocean", swatch: ["#1B3A8A", "#2F5FD0"] },
  ambra: { id: "ambra", label: "Ambra", swatch: ["#7A4210", "#C27413"] },
  ocra: { id: "ocra", label: "Ocra", swatch: ["#5C3F18", "#A87535"] },
};

export const AREA_ACCENTS: Record<AppArea, AccentId[]> = {
  restaurant: ["bordeaux", "forest", "ocean", "ambra"],
  supplier: ["ocra", "bordeaux", "forest", "ocean"],
};

export const DEFAULT_ACCENT: Record<AppArea, AccentId> = {
  restaurant: "bordeaux",
  supplier: "ocra",
};

export type WeekStart = "mon" | "sun";
export const DEFAULT_WEEK_START: WeekStart = "mon";

export const accentKey = (area: AppArea) => `gb-accent:${area}`;
export const weekStartKey = (area: AppArea) => `gb-week-start:${area}`;

const ALL_IDS = Object.keys(ACCENT_PRESETS).join("|");

/**
 * Inline script executed before first paint (rendered by the area layouts)
 * so a non-default accent never flashes the default colour.
 */
export function accentBootScript(area: AppArea): string {
  return `(function(){try{var d=document.documentElement;d.setAttribute("data-accent-area","${area}");var v=localStorage.getItem("${accentKey(
    area,
  )}");if(v&&/^(${ALL_IDS})$/.test(v)&&v!=="${DEFAULT_ACCENT[area]}"){d.setAttribute("data-accent",v)}else{d.removeAttribute("data-accent")}}catch(e){}})();`;
}

export function readStoredAccent(area: AppArea): AccentId {
  try {
    const v = window.localStorage.getItem(accentKey(area));
    if (v && v in ACCENT_PRESETS) return v as AccentId;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_ACCENT[area];
}

export function readStoredWeekStart(area: AppArea): WeekStart {
  try {
    const v = window.localStorage.getItem(weekStartKey(area));
    if (v === "sun" || v === "mon") return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_WEEK_START;
}

export function applyAccentToDocument(area: AppArea, accent: AccentId): void {
  const d = document.documentElement;
  d.setAttribute("data-accent-area", area);
  if (accent === DEFAULT_ACCENT[area]) d.removeAttribute("data-accent");
  else d.setAttribute("data-accent", accent);
}
