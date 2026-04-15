"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import type { ExclusionReason, Offer } from "@/lib/scoring";

export type ExcludedItem = {
  offer: Offer;
  reasons: ExclusionReason[];
  /** Optional override for supplier display name (adapter callers pass this). */
  supplierName?: string;
};

function reasonToItalian(r: ExclusionReason): string {
  switch (r.kind) {
    case "min_order_too_high":
      return `Ordine minimo €${r.actual.toFixed(0)} supera la tua soglia €${r.threshold.toFixed(0)}`;
    case "lead_time_too_slow":
      return `Consegna in ${r.actual} giorni (richiesti max ${r.max})`;
    case "missing_certification":
      return `Manca certificazione ${r.required}`;
    case "supplier_blocked":
      return "Fornitore escluso dalle tue preferenze";
    case "quality_tier_too_low":
      return `Qualità ${r.actual} sotto la soglia richiesta ${r.min}`;
  }
}

/**
 * Collapsible list of offers that failed hard constraints. Closed by
 * default. Each item shows supplier + product and a bullet list of
 * Italian human-readable reasons.
 */
export function ExclusionList({
  excluded,
}: {
  excluded: ExcludedItem[];
}) {
  const [open, setOpen] = useState(false);
  if (excluded.length === 0) return null;

  return (
    <div className="rounded-xl border border-sage/20 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-charcoal hover:bg-sage-muted/30"
      >
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="font-medium">
            {excluded.length}{" "}
            {excluded.length === 1 ? "offerta esclusa" : "offerte escluse"}
          </span>
          <span className="text-sage">dai tuoi vincoli</span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-sage" />
        ) : (
          <ChevronRight className="h-4 w-4 text-sage" />
        )}
      </button>
      {open && (
        <ul className="divide-y divide-sage/10 px-4 py-2 text-sm">
          {excluded.map((e, i) => (
            <li key={`${e.offer.id}-${i}`} className="py-2">
              <p className="font-medium text-charcoal">
                {e.supplierName ?? e.offer.supplierId}
                <span className="ml-2 text-xs font-normal text-sage">
                  {e.offer.productName}
                </span>
              </p>
              <ul className="mt-1 space-y-0.5 text-sage">
                {e.reasons.map((r, j) => (
                  <li key={j}>• {reasonToItalian(r)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
