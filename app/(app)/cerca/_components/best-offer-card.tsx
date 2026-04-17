// app/(app)/cerca/_components/best-offer-card.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group } from "../_lib/types";

export function BestOfferCard({
  group,
  onAddToTypical,
}: {
  group: Group;
  onAddToTypical: () => void;
}) {
  const best = group.offers[0];
  if (!best) return null;
  const scoreCls = scoreColorClass(best.scored.score);

  return (
    <section className="space-y-2 border-b border-border-subtle px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Best offer
      </p>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`font-mono text-[28px] font-semibold tabular-nums ${scoreCls}`}>
          € {best.price.toFixed(2)}
        </span>
        <span className={`font-mono text-[12px] tabular-nums ${scoreCls}`}>
          score {best.scored.score.toFixed(1)}
        </span>
      </div>
      <p className="text-[13px] text-text-secondary">
        da{" "}
        <Link
          href={`/cataloghi/${best.supplier.id}`}
          className="font-medium text-text-primary hover:underline"
        >
          {best.supplier.supplier_name}
        </Link>
      </p>
      <p className="font-mono text-[11px] text-text-tertiary">
        lead {best.supplier.delivery_days ?? 2}g
        {best.supplier.min_order_amount
          ? ` · min € ${best.supplier.min_order_amount.toFixed(0)}`
          : ""}
      </p>
      <button
        onClick={onAddToTypical}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-green px-3 py-2 text-[13px] font-medium text-surface-base hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Aggiungi a ordine tipico
      </button>
    </section>
  );
}
