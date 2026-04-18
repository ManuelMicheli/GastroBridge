// app/(app)/cataloghi/confronta/_components/compare-header.tsx
//
// Terminal-styled header for the price-compare view. Shows the breadcrumb
// back link, section label + title, and a trailing saving pill when the
// optimal basket beats the worst single-supplier total.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  supplierCount: number;
  productCount: number;
  saving: number;
  savingPct: number;
};

export function CompareHeader({
  supplierCount,
  productCount,
  saving,
  savingPct,
}: Props) {
  const hasSaving = saving > 0;

  return (
    <header className="space-y-3 border-b border-border-subtle pb-4">
      <Link
        href="/cataloghi"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary hover:text-text-primary min-h-[32px] -my-1 py-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Cataloghi
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
            Confronto
            <span className="mx-2 text-border-subtle">·</span>
            <span className="tabular-nums text-text-secondary">
              {supplierCount} fornitori
            </span>
            <span className="mx-2 text-border-subtle">·</span>
            <span className="tabular-nums text-text-secondary">
              {productCount} prodotti
            </span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">
            Tabella prezzi
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Miglior prezzo evidenziato in{" "}
            <span className="text-accent-green">verde</span>. Punteggio dalle
            tue preferenze nel tooltip.
          </p>
        </div>

        {hasSaving && (
          <span className="inline-flex items-center gap-2 rounded-md border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-green">
            <span>Risparmio</span>
            <span className="tabular-nums">€ {saving.toFixed(2)}</span>
            <span className="text-accent-green/70">·</span>
            <span className="tabular-nums">{savingPct.toFixed(0)}%</span>
          </span>
        )}
      </div>
    </header>
  );
}
