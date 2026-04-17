// app/(app)/cerca/_components/score-breakdown-inline.tsx
import type { ScoreBreakdown } from "@/lib/scoring";

export function ScoreBreakdownInline({ breakdown }: { breakdown: ScoreBreakdown }) {
  const rows: Array<{ label: string; value: number; weight: number }> = [
    { label: "Prezzo", value: breakdown.price, weight: Math.round(breakdown.weights.price * 100) },
    { label: "Qualità", value: breakdown.quality, weight: Math.round(breakdown.weights.quality * 100) },
    { label: "Consegna", value: breakdown.delivery, weight: Math.round(breakdown.weights.delivery * 100) },
  ];
  const total = breakdown.weights.price * breakdown.price
    + breakdown.weights.quality * breakdown.quality
    + breakdown.weights.delivery * breakdown.delivery
    + breakdown.bioBonus + breakdown.km0Bonus;

  return (
    <div className="space-y-2 px-4 py-4 border-t border-border-subtle">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Breakdown
      </h4>
      <ul className="space-y-1.5 text-[12px]">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[80px_1fr_40px] items-center gap-2">
            <span className="text-text-secondary">
              {r.label} <span className="text-[10px] text-text-tertiary">({r.weight}%)</span>
            </span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-surface-hover">
              <span
                className="absolute inset-y-0 left-0 bg-accent-green/70 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(0, Math.min(100, r.value))}%` }}
              />
            </span>
            <span className="text-right font-mono tabular-nums text-text-primary">
              {Math.round(r.value)}
            </span>
          </li>
        ))}
        {breakdown.bioBonus > 0 && (
          <li className="grid grid-cols-[80px_1fr_40px] gap-2 text-accent-green">
            <span>+ Bio</span>
            <span />
            <span className="text-right font-mono tabular-nums">+{breakdown.bioBonus}</span>
          </li>
        )}
        {breakdown.km0Bonus > 0 && (
          <li className="grid grid-cols-[80px_1fr_40px] gap-2 text-accent-green">
            <span>+ km0</span>
            <span />
            <span className="text-right font-mono tabular-nums">+{breakdown.km0Bonus}</span>
          </li>
        )}
      </ul>
      <div className="flex items-baseline justify-between border-t border-border-subtle pt-2 font-mono text-[12px]">
        <span className="uppercase tracking-wide text-text-tertiary">totale</span>
        <span className="tabular-nums text-text-primary text-[14px] font-semibold">
          {Math.round(total)}
        </span>
      </div>
    </div>
  );
}
