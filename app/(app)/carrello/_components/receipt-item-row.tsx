"use client";

import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import type { CartItem } from "@/types/orders";
import type { UnitType } from "@/types/database";

type Props = {
  item: CartItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
};

/**
 * One receipt line-item. Layout:
 *   ▸ <name>  <qty><unit>
 *     <supplierName>
 *     € <unit> × <qty>     € <line-total>
 *     [-] [ n ] [+]              [×]
 */
export function ReceiptItemRow({ item, onInc, onDec, onRemove }: Props) {
  const unit = formatUnitShort(item.unit as UnitType);
  const lineTotal = item.unitPrice * item.quantity;
  const canDec = item.quantity > item.minQuantity;

  return (
    <div className="group py-3 font-mono text-[13px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            aria-hidden="true"
            className="text-text-tertiary select-none leading-5"
          >
            ▸
          </span>
          <p className="min-w-0 truncate text-text-primary leading-5">
            {item.name}
          </p>
        </div>
        <span className="shrink-0 tabular-nums text-text-secondary leading-5">
          {item.quantity} {unit}
        </span>
      </div>

      {item.supplierName && (
        <p className="mt-0.5 pl-4 text-[11px] text-text-tertiary truncate">
          {item.supplierName}
        </p>
      )}

      <div className="mt-1 flex items-center justify-between gap-3 pl-4">
        <span className="tabular-nums text-[11px] text-text-tertiary">
          {formatCurrency(item.unitPrice)} × {item.quantity}
        </span>
        <span className="tabular-nums text-text-primary font-semibold">
          {formatCurrency(lineTotal)}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 pl-4">
        <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border-subtle bg-surface-base/60 text-[12px] tabular-nums">
          <button
            type="button"
            onClick={onDec}
            disabled={!canDec}
            aria-label="Diminuisci quantità"
            className="flex h-7 w-7 items-center justify-center text-text-secondary transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-40"
          >
            -
          </button>
          <span className="flex h-7 min-w-[2.25rem] items-center justify-center border-x border-border-subtle px-1 text-text-primary">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={onInc}
            aria-label="Aumenta quantità"
            className="flex h-7 w-7 items-center justify-center text-text-secondary transition hover:bg-surface-card"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Rimuovi riga"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary opacity-0 transition hover:bg-surface-base hover:text-accent-orange focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
