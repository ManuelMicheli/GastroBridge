"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import type { CartBySupplier, CartItem } from "@/types/orders";
import { formatCurrency } from "@/lib/utils/formatters";
import { LargeTitle } from "@/components/ui/large-title";
import { GroupedList, GroupedListRow } from "@/components/ui/grouped-list";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";

type Props = {
  supplierGroups: CartBySupplier[];
  totalAmount: number;
  itemCount: number;
  ctaLabel: string;
  pending: boolean;
  onCheckout: () => void;
  onInc: (item: CartItem) => void;
  onDec: (item: CartItem) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
};

export function CartPageMobile({
  supplierGroups,
  totalAmount,
  itemCount,
  ctaLabel,
  pending,
  onCheckout,
  onInc,
  onDec,
  onRemove,
  onClear,
}: Props) {
  return (
    <>
      <div className="pb-36">
        <div className="px-4 pt-3">
          <Link
            href="/cerca"
            className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-brand-primary)] active:opacity-60"
          >
            <ArrowLeft className="h-4 w-4" />
            Cerca prodotti
          </Link>
        </div>
        <LargeTitle
          eyebrow="Totale carrello"
          title={
            <span
              className="font-serif text-[color:var(--color-brand-primary)]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {formatCurrency(totalAmount)}
            </span>
          }
          subtitle={
            <span>
              {itemCount} {itemCount === 1 ? "articolo" : "articoli"} ·{" "}
              {supplierGroups.length}{" "}
              {supplierGroups.length === 1 ? "fornitore" : "fornitori"}
            </span>
          }
          actions={
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg p-2 text-[color:var(--text-muted-light)] transition active:bg-black/5"
              aria-label="Svuota carrello"
            >
              <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          }
        />

        {supplierGroups.map((group) => (
          <Fragment key={group.supplierId}>
            <GroupedList
              className="mt-2"
              label={
                <span>
                  {group.supplierName}
                  {group.isBelowMinimum && group.minOrderAmount != null && (
                    <span className="ml-2 text-[10px] normal-case tracking-normal text-[#B8621E]">
                      Sotto minimo ({formatCurrency(group.minOrderAmount)})
                    </span>
                  )}
                </span>
              }
              labelAction={
                <span
                  className="font-serif text-[color:var(--color-brand-primary)]"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {formatCurrency(group.subtotal)}
                </span>
              }
            >
              {group.items.map((item) => (
                <GroupedListRow
                  key={item.productId}
                  leading={
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-[30px] w-[30px] rounded-md object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="h-[30px] w-[30px] rounded-md bg-gradient-to-br from-[#E8DDC9] to-[#D3C4AE]"
                      />
                    )
                  }
                  title={item.name}
                  subtitle={
                    <span>
                      {formatCurrency(item.unitPrice)} × {item.quantity}
                      {item.brand ? ` · ${item.brand}` : ""}
                    </span>
                  }
                  trailing={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDec(item)}
                        disabled={item.quantity <= item.minQuantity}
                        aria-label={`Riduci ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--color-brand-primary-subtle)] text-[color:var(--color-brand-primary)] transition active:bg-[color:var(--color-brand-primary)]/20 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInc(item)}
                        aria-label={`Aumenta ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-md bg-[color:var(--color-brand-primary-subtle)] text-[color:var(--color-brand-primary)] transition active:bg-[color:var(--color-brand-primary)]/20"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                />
              ))}
              <GroupedListRow
                onClick={() => {
                  for (const it of group.items) onRemove(it.productId);
                }}
                title={
                  <span className="text-[13px] text-[#C93737]">
                    Rimuovi fornitore dal carrello
                  </span>
                }
              />
            </GroupedList>
          </Fragment>
        ))}
      </div>

      <StickyActionBar>
        <button
          type="button"
          onClick={onCheckout}
          disabled={pending || supplierGroups.length === 0}
          className="flex w-full items-center justify-between rounded-xl bg-[color:var(--color-brand-primary)] px-5 py-3 text-[15px] font-semibold text-[color:var(--color-brand-on-primary)] transition active:opacity-90 disabled:opacity-60 shadow-[var(--sticky-cta-shadow)]"
          style={{ minHeight: 48 }}
        >
          <span>{pending ? "Invio…" : ctaLabel}</span>
          <span
            className="font-serif"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {formatCurrency(totalAmount)} →
          </span>
        </button>
      </StickyActionBar>
    </>
  );
}
