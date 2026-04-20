// app/(app)/cerca/_components/usual-order-panel.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBasket, Package, History, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/hooks/useCart";
import { USUAL_ORDER_WINDOW_DAYS, type UsualOrderItem } from "../_lib/usual-order";

type RowQty = Record<string, number>;

function roundQty(n: number, minQty: number): number {
  const r = Math.max(minQty, Math.round(n));
  return Number.isFinite(r) && r > 0 ? r : minQty;
}

function formatAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 7) return `${days}g fa`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}sett fa`;
  return `${Math.floor(days / 30)}mesi fa`;
}

export function UsualOrderPanel({ items }: { items: UsualOrderItem[] }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState<RowQty>(() => {
    const init: RowQty = {};
    for (const it of items) init[it.productId] = roundQty(it.avgQty, it.minQuantity);
    return init;
  });

  const totalItems = items.length;
  const estimatedTotal = useMemo(
    () =>
      items.reduce(
        (s, it) => s + it.price * (qty[it.productId] ?? roundQty(it.avgQty, it.minQuantity)),
        0,
      ),
    [items, qty],
  );

  const bump = (id: string, delta: number, minQty: number) =>
    setQty((q) => {
      const current = q[id] ?? minQty;
      const next = Math.max(minQty, current + delta);
      return { ...q, [id]: next };
    });

  const setExact = (id: string, raw: string, minQty: number) => {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    setQty((q) => ({ ...q, [id]: Math.max(minQty, n) }));
  };

  const addOne = (it: UsualOrderItem) => {
    const q = qty[it.productId] ?? roundQty(it.avgQty, it.minQuantity);
    addItem({
      productId: it.productId,
      supplierId: it.supplierId,
      supplierName: it.supplierName,
      name: it.productName,
      brand: it.brand,
      unit: it.unit,
      unitPrice: it.price,
      quantity: q,
      imageUrl: it.imageUrl,
      minQuantity: it.minQuantity,
    });
    toast.success(`"${it.productName}" aggiunto al carrello`);
  };

  const addAll = () => {
    if (items.length === 0) return;
    for (const it of items) {
      const q = qty[it.productId] ?? roundQty(it.avgQty, it.minQuantity);
      addItem({
        productId: it.productId,
        supplierId: it.supplierId,
        supplierName: it.supplierName,
        name: it.productName,
        brand: it.brand,
        unit: it.unit,
        unitPrice: it.price,
        quantity: q,
        imageUrl: it.imageUrl,
        minQuantity: it.minQuantity,
      });
    }
    toast.success(`${items.length} prodotti aggiunti al carrello`);
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-10 lg:px-4">
        <div className="rounded-xl border border-dashed border-border-subtle p-10 text-center">
          <History className="mx-auto h-8 w-8 text-text-tertiary" />
          <p className="mt-3 text-[14px] text-text-primary">Nessun prodotto ricorrente</p>
          <p className="mt-1 text-[12px] text-text-tertiary">
            I prodotti che riordini almeno 2 volte negli ultimi {USUAL_ORDER_WINDOW_DAYS} giorni compariranno qui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 lg:space-y-5 lg:px-4 lg:py-6">
      <header className="space-y-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:space-y-0">
        <div className="rounded-xl border border-border-subtle bg-surface-card px-4 py-3 lg:border-0 lg:bg-transparent lg:p-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Ordine solito · ultimi {USUAL_ORDER_WINDOW_DAYS} giorni · {totalItems} prodotti
          </p>
          <p className="font-mono text-[20px] tabular-nums text-text-primary lg:text-[18px]">
            totale stimato <span className="text-accent-green">€ {estimatedTotal.toFixed(2)}</span>
          </p>
        </div>
        <button
          onClick={addAll}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-green px-4 py-3 text-[14px] font-medium text-surface-base lg:w-auto lg:py-2.5 lg:text-[13px]"
        >
          <ShoppingBasket className="h-4 w-4" /> Aggiungi tutto a carrello
        </button>
      </header>

      <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-card">
        {items.map((it) => {
          const minQ = it.minQuantity > 0 ? it.minQuantity : 1;
          const current = qty[it.productId] ?? roundQty(it.avgQty, minQ);
          const rowTotal = current * it.price;
          return (
            <li
              key={it.productId}
              className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-text-primary">{it.productName}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-text-tertiary">
                  <Link href={`/cataloghi/${it.supplierId}`} className="hover:text-text-primary hover:underline">
                    {it.supplierName}
                  </Link>
                  <span>·</span>
                  <span>€ {it.price.toFixed(2)}/{it.unit}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {it.timesOrdered}x
                  </span>
                  <span>·</span>
                  <span>{formatAgo(it.lastOrderedAt)}</span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="inline-flex items-center rounded-lg border border-border-subtle">
                  <button
                    onClick={() => bump(it.productId, -1, minQ)}
                    className="px-2 py-1.5 text-text-secondary hover:bg-surface-hover disabled:opacity-40"
                    disabled={current <= minQ}
                    aria-label="diminuisci"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    value={current}
                    onChange={(e) => setExact(it.productId, e.target.value, minQ)}
                    inputMode="decimal"
                    className="w-12 bg-transparent text-center font-mono text-[13px] tabular-nums outline-none"
                  />
                  <button
                    onClick={() => bump(it.productId, 1, minQ)}
                    className="px-2 py-1.5 text-text-secondary hover:bg-surface-hover"
                    aria-label="aumenta"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="hidden w-20 text-right font-mono text-[12px] tabular-nums text-text-tertiary sm:block">
                  € {rowTotal.toFixed(2)}
                </div>

                <button
                  onClick={() => addOne(it)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface-hover"
                >
                  <ShoppingBasket className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
