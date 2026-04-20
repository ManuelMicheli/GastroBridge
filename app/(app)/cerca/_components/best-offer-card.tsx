// app/(app)/cerca/_components/best-offer-card.tsx
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group } from "../_lib/types";

export function BestOfferCard({
  group,
  qty,
  onQtyChange,
  onAddToCart,
}: {
  group: Group;
  qty: number;
  onQtyChange: (qty: number) => void;
  onAddToCart: () => void;
}) {
  const clamp = (n: number) => Math.max(1, Math.min(999, Math.floor(n) || 1));
  const dec = () => onQtyChange(clamp(qty - 1));
  const inc = () => onQtyChange(clamp(qty + 1));
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
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center rounded-lg border border-border-subtle bg-surface-base">
          <button
            type="button"
            onClick={dec}
            disabled={qty <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-l-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Diminuisci quantità"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={qty}
            onChange={(e) => onQtyChange(clamp(Number(e.target.value)))}
            className="w-12 border-x border-border-subtle bg-transparent px-1 py-1.5 text-center font-mono text-[13px] tabular-nums text-text-primary outline-none focus:bg-surface-hover [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Quantità"
          />
          <button
            type="button"
            onClick={inc}
            disabled={qty >= 999}
            className="flex h-9 w-9 items-center justify-center rounded-r-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Aumenta quantità"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-text-tertiary">
          {group.unit}
        </span>
        <span className="ml-auto font-mono text-[12px] tabular-nums text-text-secondary">
          € {(best.price * qty).toFixed(2)}
        </span>
      </div>
      <button
        onClick={onAddToCart}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-green px-3 py-2 text-[13px] font-medium text-surface-base hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Aggiungi al carrello
      </button>
    </section>
  );
}
