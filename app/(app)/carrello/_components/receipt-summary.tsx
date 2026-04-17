"use client";

import { formatCurrency } from "@/lib/utils/formatters";

type Props = {
  subtotal: number;
  itemCount: number;
  supplierCount: number;
  pending: boolean;
  ctaLabel: string;
  onCheckout: () => void;
};

/**
 * Bottom of the receipt: totals block + primary CTA.
 * The button intentionally breaks from the system <Button> to keep the
 * terminal/receipt feel (monospaced, wide letter-spacing, full-width).
 */
export function ReceiptSummary({
  subtotal,
  itemCount,
  supplierCount,
  pending,
  ctaLabel,
  onCheckout,
}: Props) {
  return (
    <section className="px-6 py-5 font-mono text-[12px]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
        Riepilogo
      </p>

      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary">subtotal</span>
          <span className="tabular-nums text-text-primary">
            {formatCurrency(subtotal)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary">articoli</span>
          <span className="tabular-nums text-text-primary">{itemCount}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary">fornitori</span>
          <span className="tabular-nums text-text-primary">
            {supplierCount}
          </span>
        </div>
      </div>

      <p
        aria-hidden="true"
        className="mt-3 text-[11px] tracking-[0.05em] text-text-tertiary select-none"
      >
        ──────────────────
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
        <span className="uppercase tracking-[0.15em] text-text-primary font-semibold">
          TOTALE
        </span>
        <span className="tabular-nums text-text-primary font-semibold">
          {formatCurrency(subtotal)}
        </span>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={pending}
        className="mt-5 w-full rounded-lg bg-accent-green px-4 py-3 font-mono text-[12px] uppercase tracking-[0.15em] text-surface-base transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Invio in corso…" : ctaLabel}
      </button>
    </section>
  );
}
