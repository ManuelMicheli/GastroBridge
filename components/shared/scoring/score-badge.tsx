/**
 * Tailwind text-color class derived from a 0-100 score.
 * Green ≥80, yellow 50-79, orange 20-49, red <20.
 *
 * Usage: apply to the price element to color it by score instead of showing
 * a separate score badge.
 */
export function scoreColorClass(score: number): string {
  if (score >= 80) return "text-accent-green";
  if (score >= 50) return "text-yellow-500";
  if (score >= 20) return "text-orange-500";
  return "text-red-600";
}
