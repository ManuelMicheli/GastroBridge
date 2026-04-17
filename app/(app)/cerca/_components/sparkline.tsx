// app/(app)/cerca/_components/sparkline.tsx
import type { RankedOffer } from "../_lib/types";

/**
 * Micro bar chart: one bar per offer, height inversely proportional to
 * price (cheapest = tallest), color derived from score.
 * 48×16 fixed box, renders inline SVG — zero runtime deps.
 */
export function Sparkline({ offers, max = 8 }: { offers: RankedOffer[]; max?: number }) {
  const slice = offers.slice(0, max);
  if (slice.length === 0) return null;

  const prices = slice.map((o) => o.price);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const range = Math.max(pMax - pMin, 0.0001);
  const w = 48;
  const h = 16;
  const barW = Math.max(2, Math.floor(w / slice.length) - 1);

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0"
      aria-hidden
    >
      {slice.map((o, i) => {
        const norm = 1 - (o.price - pMin) / range; // cheaper = taller
        const barH = Math.max(2, Math.round(norm * (h - 2)));
        const y = h - barH;
        const x = i * (barW + 1);
        const fill =
          o.scored.score >= 80
            ? "var(--color-accent-green, #10b981)"
            : o.scored.score >= 50
            ? "#eab308"
            : o.scored.score >= 20
            ? "#f97316"
            : "#dc2626";
        return <rect key={i} x={x} y={y} width={barW} height={barH} fill={fill} rx={0.5} />;
      })}
    </svg>
  );
}
