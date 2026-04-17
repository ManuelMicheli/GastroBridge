// app/(app)/cerca/_components/offer-list.tsx
"use client";

import Link from "next/link";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import type { Group, RankedOffer } from "../_lib/types";

export function OfferList({
  group,
  selectedOfferId,
  onSelectOffer,
}: {
  group: Group;
  selectedOfferId: string | null;
  onSelectOffer: (offer: RankedOffer) => void;
}) {
  const prices = group.offers.map((o) => o.price);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const span = Math.max(pMax - pMin, 0.0001);

  return (
    <section className="space-y-1.5 px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        Tutte le offerte
      </p>
      <ul className="space-y-0.5">
        {group.offers.map((o) => {
          const pct = 1 - (o.price - pMin) / span;
          const sel = o.itemId === selectedOfferId;
          const cls = scoreColorClass(o.scored.score);
          return (
            <li key={o.itemId}>
              <button
                onClick={() => onSelectOffer(o)}
                className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-left text-[12px] ${
                  sel ? "bg-accent-green/10" : "hover:bg-surface-hover"
                }`}
              >
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 bg-accent-green/5 transition-[width] duration-300"
                  style={{ width: `${Math.max(4, Math.round(pct * 100))}%` }}
                  aria-hidden
                />
                <Link
                  href={`/cataloghi/${o.supplier.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="relative truncate text-text-primary hover:underline"
                >
                  {o.supplier.supplier_name}
                </Link>
                <span className={`relative font-mono tabular-nums ${cls}`}>
                  € {o.price.toFixed(2)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
