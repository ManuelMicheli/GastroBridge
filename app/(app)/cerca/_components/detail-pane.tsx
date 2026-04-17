// app/(app)/cerca/_components/detail-pane.tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BestOfferCard } from "./best-offer-card";
import { OfferList } from "./offer-list";
import { ScoreBreakdownInline } from "./score-breakdown-inline";
import type { Group, OrderLine, RankedOffer } from "../_lib/types";

export function DetailPane({
  group,
  onClose,
  onAddToTypical,
}: {
  group: Group | null;
  onClose: () => void;
  onAddToTypical: (line: OrderLine) => void;
}) {
  const [selectedOffer, setSelectedOffer] = useState<RankedOffer | null>(null);

  useEffect(() => {
    setSelectedOffer(group?.offers[0] ?? null);
  }, [group?.key]);

  if (!group) {
    return (
      <aside
        className="hidden h-full border-l border-border-subtle bg-surface-card lg:block"
        role="region"
        aria-label="Dettagli prodotto"
      >
        <div className="flex h-full items-center justify-center p-10 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary">
          ← seleziona un prodotto dalla lista
        </div>
      </aside>
    );
  }

  const add = () => {
    onAddToTypical({
      key: group.key,
      productName: group.productName,
      unit: group.unit,
      qty: 1,
    });
  };

  return (
    <aside
      className="flex h-full flex-col border-l border-border-subtle bg-surface-card"
      role="region"
      aria-label={`Dettagli ${group.productName}`}
    >
      <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border-subtle">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[18px] font-semibold text-text-primary">
            {group.productName}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-text-tertiary">
            {group.unit} · {group.offers.length} offerte · media € {group.averagePrice.toFixed(2)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Chiudi dettagli"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <BestOfferCard group={group} onAddToTypical={add} />
        <OfferList
          group={group}
          selectedOfferId={selectedOffer?.itemId ?? null}
          onSelectOffer={setSelectedOffer}
        />
        {selectedOffer && <ScoreBreakdownInline breakdown={selectedOffer.scored.breakdown} />}
      </div>
    </aside>
  );
}
