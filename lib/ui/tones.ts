// lib/ui/tones.ts
//
// Shared palette "tone" type for restaurant-area badges/dots.
// Each tone has matching --tone-{tone}-bg, --tone-{tone}-fg, --tone-{tone}-ring
// CSS variables scoped under [data-area="restaurant"] in globals.css.

export const TONE_NAMES = [
  "neutral",
  "amber",
  "blue",
  "brand",
  "emerald",
  "rose",
] as const;

export type StatusTone = (typeof TONE_NAMES)[number];
