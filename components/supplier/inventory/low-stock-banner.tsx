"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  count: number;
  onShowAll?: () => void;
};

/**
 * Banner arancione mostrato in cima alla pagina `/supplier/magazzino` quando
 * esistono prodotti sotto scorta. Il click su "Vedi tutti" inoltra il filtro
 * alla tabella (gestito dal client parent).
 */
export function LowStockBanner({ count, onShowAll }: Props) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent-amber/40 bg-accent-amber/10 px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-accent-amber" aria-hidden />
      <div className="flex-1 text-sm text-text-primary">
        <strong className="font-semibold">
          {count} {count === 1 ? "prodotto" : "prodotti"} sotto scorta
        </strong>
        <span className="ml-1 text-text-secondary">
          — disponibilità sotto la soglia configurata.
        </span>
      </div>
      {onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className="shrink-0 rounded-md border border-accent-amber/40 px-3 py-1.5 text-xs font-medium text-accent-amber hover:bg-accent-amber/20"
        >
          Vedi tutti
        </button>
      )}
    </div>
  );
}
