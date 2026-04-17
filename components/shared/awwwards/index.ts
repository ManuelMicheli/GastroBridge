// components/shared/awwwards/index.ts
//
// Shared terminal-dense primitives used by awwwards-grade split views
// (/cerca, /fornitori). Re-exports from the canonical /cerca implementation
// so both routes stay in lockstep without duplication.

export { FacetGroup, FacetCheckboxRow } from "@/app/(app)/cerca/_components/facet-group";
export { PriceRange, ScoreSlider } from "@/app/(app)/cerca/_components/facet-range";
export { MobileDrawer } from "@/app/(app)/cerca/_components/mobile-drawer";
export { KeyboardHint } from "@/app/(app)/cerca/_components/keyboard-hint";
export { CheatsheetOverlay } from "@/app/(app)/cerca/_components/cheatsheet-overlay";
export { useSearchKeyboard, type KeyHandlers } from "@/app/(app)/cerca/_lib/use-keyboard";
