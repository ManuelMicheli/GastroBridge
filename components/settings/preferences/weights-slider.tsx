"use client";

export type WeightTriple = {
  price: number;
  quality: number;
  delivery: number;
};

type Key = keyof WeightTriple;

/**
 * Redistribute so that sum == 100. When `changed` moves by delta, subtract
 * that delta proportionally from the other two (never go below 0).
 */
function redistribute(
  current: WeightTriple,
  changed: Key,
  nextValue: number
): WeightTriple {
  const clamped = Math.max(0, Math.min(100, Math.round(nextValue)));
  const others: Key[] = (["price", "quality", "delivery"] as Key[]).filter(
    (k) => k !== changed
  );
  const remainder = 100 - clamped;
  const [a, b] = others as [Key, Key];
  const othersTotal = current[a] + current[b];

  let aNext: number;
  let bNext: number;
  if (othersTotal <= 0) {
    aNext = Math.floor(remainder / 2);
    bNext = remainder - aNext;
  } else {
    aNext = Math.round((current[a] / othersTotal) * remainder);
    bNext = remainder - aNext;
    if (aNext < 0) {
      aNext = 0;
      bNext = remainder;
    }
    if (bNext < 0) {
      bNext = 0;
      aNext = remainder;
    }
  }

  const result: WeightTriple = { price: 0, quality: 0, delivery: 0 };
  result[changed] = clamped;
  result[a] = aNext;
  result[b] = bNext;
  return result;
}

const LABELS: Record<Key, string> = {
  price: "Prezzo",
  quality: "Qualità",
  delivery: "Consegna",
};

const DESCRIPTIONS: Record<Key, string> = {
  price: "Preferisci offerte convenienti",
  quality: "Dai priorità a tier alti e certificazioni",
  delivery: "Lead time e affidabilità logistica",
};

export function WeightsSlider({
  value,
  onChange,
  disabled,
}: {
  value: WeightTriple;
  onChange: (next: WeightTriple) => void;
  disabled?: boolean;
}) {
  const keys: Key[] = ["price", "quality", "delivery"];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        {keys.map((k) => (
          <div
            key={k}
            className="rounded-2xl bg-sage-muted/10 p-4 border border-sage-muted/40"
          >
            <div className="text-xs uppercase tracking-wide text-sage font-semibold">
              {LABELS[k]}
            </div>
            <div className="text-3xl font-bold text-charcoal mt-1">
              {value[k]}%
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {keys.map((k) => (
          <div key={k}>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={`weight-${k}`}
                className="text-sm font-semibold text-charcoal"
              >
                {LABELS[k]}
              </label>
              <span className="text-xs text-sage">{DESCRIPTIONS[k]}</span>
            </div>
            <input
              id={`weight-${k}`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={value[k]}
              disabled={disabled}
              onChange={(e) =>
                onChange(redistribute(value, k, Number(e.target.value)))
              }
              className="w-full accent-forest disabled:opacity-50"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
