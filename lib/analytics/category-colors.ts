import type { MacroCategory } from "./category-keywords";

// Hex palette derived from --color-accent-* tokens in globals.css
// (we pass hex to Recharts which does not resolve CSS variables at render).
export const MACRO_CATEGORY_COLORS: Record<MacroCategory, string> = {
  carne: "#E8773A",
  pesce: "#60A5FA",
  verdura: "#2DD47A",
  frutta: "#FACC15",
  latticini: "#F5F5F7",
  secco: "#D9A15E",
  bevande: "#A855F7",
  surgelati: "#5BCEA6",
  panetteria: "#F59E0B",
  altro: "#8A8A9A",
};
