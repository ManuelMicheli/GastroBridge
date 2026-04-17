"use client";

import { formatCurrency } from "@/lib/utils/formatters";

type Props = {
  supplierName: string;
  itemCount: number;
  subtotal: number;
  minOrderAmount: number | null;
  leadTimeDays: number | null;
};

/**
 * Per-supplier split summary. Shows item count, lead time (if known),
 * subtotal, and min-order validation status with ✓ / ⚠ glyphs.
 */
export function ReceiptSupplierBlock({
  supplierName,
  itemCount,
  subtotal,
  minOrderAmount,
  leadTimeDays,
}: Props) {
  const below = minOrderAmount !== null && subtotal < minOrderAmount;
  const missing = below ? (minOrderAmount as number) - subtotal : 0;

  return (
    <div className="font-mono text-[12px]">
      <p className="flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-text-primary">
        <span aria-hidden="true" className="text-accent-green">
          ●
        </span>
        <span className="truncate">{supplierName}</span>
      </p>

      <div className="mt-1 pl-4 space-y-1">
        <p className="text-[11px] text-text-tertiary tabular-nums">
          {itemCount} {itemCount === 1 ? "articolo" : "articoli"}
          {leadTimeDays !== null && (
            <>
              {"  ·  lead "}
              {leadTimeDays}g
            </>
          )}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary">subtotal</span>
          <span className="tabular-nums text-text-primary">
            {formatCurrency(subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-text-secondary">min ordine</span>
          <span className="flex items-center gap-1.5 tabular-nums text-text-primary">
            {minOrderAmount !== null ? formatCurrency(minOrderAmount) : "—"}
            {minOrderAmount !== null &&
              (below ? (
                <span aria-label="Sotto il minimo d'ordine" className="text-accent-orange">
                  ⚠
                </span>
              ) : (
                <span aria-label="Minimo d'ordine raggiunto" className="text-accent-green">
                  ✓
                </span>
              ))}
          </span>
        </div>

        {below && (
          <p className="text-[11px] tabular-nums text-accent-orange">
            (mancano {formatCurrency(missing)})
          </p>
        )}
      </div>
    </div>
  );
}
