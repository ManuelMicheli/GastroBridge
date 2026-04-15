import type { ScoreBreakdown } from "@/lib/scoring";

/**
 * Small inline breakdown panel for a scored offer. Shows price/quality/
 * delivery components (0-100) with the active weights as sub-labels, plus
 * bio / km0 bonus rows when present.
 *
 * Designed to render inside a `<details>` popover — see usage in
 * search-client / cart-client.
 */
export function BreakdownTooltip({ breakdown }: { breakdown: ScoreBreakdown }) {
  const b = breakdown;
  const wp = Math.round(b.weights.price * 100);
  const wq = Math.round(b.weights.quality * 100);
  const wd = Math.round(b.weights.delivery * 100);

  return (
    <div className="w-56 rounded-lg border border-sage/20 bg-white p-3 text-xs text-charcoal shadow-lg">
      <p className="mb-2 font-semibold">Dettaglio punteggio</p>
      <Row label="Prezzo" value={b.price} weight={wp} />
      <Row label="Qualità" value={b.quality} weight={wq} />
      <Row label="Consegna" value={b.delivery} weight={wd} />
      {b.bioBonus > 0 && (
        <div className="mt-1 flex justify-between text-accent-green">
          <span>+ Bonus BIO</span>
          <span className="tabular-nums">+{b.bioBonus}</span>
        </div>
      )}
      {b.km0Bonus > 0 && (
        <div className="flex justify-between text-accent-green">
          <span>+ Bonus km0</span>
          <span className="tabular-nums">+{b.km0Bonus}</span>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-sage">
        {label}{" "}
        <span className="text-[10px] text-sage/70">(peso {weight}%)</span>
      </span>
      <span className="tabular-nums font-medium">{Math.round(value)}</span>
    </div>
  );
}
