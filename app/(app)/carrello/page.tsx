"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { useCart } from "@/lib/hooks/useCart";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyCartIllustration } from "@/components/illustrations";

import { ReceiptHeader } from "./_components/receipt-header";
import { ReceiptItemRow } from "./_components/receipt-item-row";
import { ReceiptSupplierBlock } from "./_components/receipt-supplier-block";
import { ReceiptSummary } from "./_components/receipt-summary";
import { ReceiptFooter } from "./_components/receipt-footer";
import { CartPageMobile } from "./cart-page-mobile";
import type { CartItem } from "@/types/orders";
import { runCheckout } from "./_lib/checkout";
import {
  fetchCurrentRestaurant,
  fetchSupplierRequirements,
  type SupplierRequirementsMap,
} from "./_lib/supplier-requirements";

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    getCartBySupplier,
    totalAmount,
  } = useCart();
  const [pending, startTransition] = useTransition();

  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [requirements, setRequirements] = useState<SupplierRequirementsMap>({});

  const supplierGroups = getCartBySupplier();
  const supplierIdsKey = supplierGroups.map((g) => g.supplierId).join("|");
  const supplierIds = useMemo(
    () => supplierGroups.map((g) => g.supplierId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supplierIdsKey],
  );

  useEffect(() => {
    let cancelled = false;
    fetchCurrentRestaurant().then((r) => {
      if (!cancelled) setRestaurant(r);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (supplierIds.length === 0) {
      setRequirements({});
      return;
    }
    let cancelled = false;
    fetchSupplierRequirements(supplierIds).then((map) => {
      if (!cancelled) setRequirements(map);
    });
    return () => { cancelled = true; };
  }, [supplierIds]);

  const itemCount = items.length;

  function handleCheckout() {
    if (items.length === 0) return;
    startTransition(async () => {
      const res = await runCheckout({
        items,
        supplierGroups,
        restaurantId: restaurant?.id ?? null,
      });
      if (!res.ok) {
        toast(`Errore ${res.error}`);
        return;
      }
      toast("Ordine inviato con successo!");
      clearCart();
      try { localStorage.removeItem("gb.typical-order"); } catch { /* ignore */ }
      router.push("/dashboard");
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Il carrello è vuoto"
        description="Cerca prodotti e aggiungili al carrello per iniziare un ordine multi-fornitore."
        illustration={<EmptyCartIllustration />}
        context="page"
        action={
          <Link
            href="/cerca"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-medium text-brand-on-primary transition-colors hover:bg-brand-primary-hover"
          >
            <Search className="h-4 w-4" />
            Cerca prodotti
          </Link>
        }
      />
    );
  }

  const ctaLabel =
    supplierGroups.length === 1
      ? "Invia ordine"
      : `Invia ordini a ${supplierGroups.length} forn.`;

  return (
    <>
      {/* Mobile Apple-app view */}
      <div className="lg:hidden">
        <CartPageMobile
          supplierGroups={supplierGroups}
          totalAmount={totalAmount}
          itemCount={itemCount}
          ctaLabel={ctaLabel}
          pending={pending}
          onCheckout={handleCheckout}
          onInc={(it: CartItem) => updateQuantity(it.productId, it.quantity + 1)}
          onDec={(it: CartItem) =>
            updateQuantity(
              it.productId,
              Math.max(it.minQuantity, it.quantity - 1),
            )
          }
          onRemove={removeItem}
          onClear={clearCart}
        />
      </div>

      {/* Desktop receipt view */}
      <div className="hidden lg:block mx-auto max-w-[640px] px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/cerca"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          cerca prodotti
        </Link>
      </div>
      <article className="rounded-xl border border-border-subtle bg-surface-card">
        <ReceiptHeader restaurantName={restaurant?.name ?? null} />

        <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />

        {/* PRODOTTI */}
        <section className="px-6 py-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
              Prodotti · {itemCount} {itemCount === 1 ? "articolo" : "articoli"}
            </p>
            <button
              type="button"
              onClick={clearCart}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-tertiary transition hover:text-accent-orange"
            >
              svuota
            </button>
          </div>

          <div className="mt-3 divide-y divide-dashed divide-border-subtle">
            {supplierGroups.map((group) =>
              group.items.map((item) => (
                <ReceiptItemRow
                  key={item.productId}
                  item={item}
                  onInc={() => updateQuantity(item.productId, item.quantity + 1)}
                  onDec={() =>
                    updateQuantity(
                      item.productId,
                      Math.max(item.minQuantity, item.quantity - 1),
                    )
                  }
                  onRemove={() => removeItem(item.productId)}
                />
              )),
            )}
          </div>
        </section>

        <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />

        {/* SPLIT FORNITORI */}
        <section className="px-6 py-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
            Split fornitori · {supplierGroups.length}
          </p>

          <div className="mt-3 space-y-4">
            {supplierGroups.map((group, i) => {
              const req = requirements[group.supplierId];
              return (
                <Fragment key={group.supplierId}>
                  <ReceiptSupplierBlock
                    supplierName={group.supplierName}
                    itemCount={group.items.length}
                    subtotal={group.subtotal}
                    minOrderAmount={req?.minOrderAmount ?? null}
                    leadTimeDays={req?.leadTimeDays ?? null}
                  />
                  {i < supplierGroups.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="border-t border-dashed border-border-subtle/60"
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        </section>

        <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />

        <ReceiptSummary
          subtotal={totalAmount}
          itemCount={itemCount}
          supplierCount={supplierGroups.length}
          pending={pending}
          ctaLabel={ctaLabel}
          onCheckout={handleCheckout}
        />

        <ReceiptFooter />
      </article>
      </div>
    </>
  );
}
