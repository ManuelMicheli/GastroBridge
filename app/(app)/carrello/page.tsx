"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/hooks/useCart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyCartIllustration } from "@/components/illustrations";
import { formatCurrency, formatUnitShort } from "@/lib/utils/formatters";
import { Trash2, Plus, Minus, AlertTriangle } from "lucide-react";
import type { UnitType } from "@/types/database";
import { createCatalogOrder } from "@/lib/orders/actions";
import { submitOrder } from "@/lib/orders/submit";
import { createClient } from "@/lib/supabase/client";

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, getCartBySupplier, totalAmount } = useCart();
  const [pending, startTransition] = useTransition();

  const supplierGroups = getCartBySupplier();

  /**
   * Il carrello può contenere due tipi di righe:
   *  - real product: `productId` è un UUID di `products` → submitOrder (RPC
   *    atomica con order_splits / order_split_items).
   *  - catalog item: `productId` ha prefisso `catalog_<id>` (cataloghi importati
   *    da PDF/Excel) → createCatalogOrder (header-only, senza FK su products).
   *
   * Se il carrello mischia i due tipi, inviamo prima l'ordine marketplace e
   * poi l'ordine catalog come fallback.
   */
  function isCatalogItem(productId: string): boolean {
    return productId.startsWith("catalog_");
  }

  async function getCurrentRestaurantId(): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("restaurants")
      .select("id")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle<{ id: string }>();
    return data?.id ?? null;
  }

  function handleCheckout() {
    if (items.length === 0) return;

    const realItems    = items.filter((it) => !isCatalogItem(it.productId));
    const catalogItems = items.filter((it) => isCatalogItem(it.productId));

    const summaryLines: string[] = [];
    for (const g of supplierGroups) {
      summaryLines.push(`--- ${g.supplierName} (${formatCurrency(g.subtotal)}) ---`);
      for (const it of g.items) {
        summaryLines.push(`  ${it.quantity}× ${it.name} @ ${formatCurrency(it.unitPrice)}`);
      }
    }

    startTransition(async () => {
      let anyOk = false;

      // 1. Marketplace items via submitOrder (RPC atomica).
      if (realItems.length > 0) {
        const restaurantId = await getCurrentRestaurantId();
        if (!restaurantId) {
          toast("Errore: Ristorante non trovato");
          return;
        }
        const res = await submitOrder({
          restaurantId,
          items: realItems.map((it) => ({
            productId:  it.productId,
            supplierId: it.supplierId,
            quantity:   it.quantity,
            unitPrice:  it.unitPrice,
          })),
          notes: `Ordine da carrello (${realItems.length} righe)`,
        });
        if (!res.ok) {
          toast(`Errore ordine: ${res.error}`);
          return;
        }
        anyOk = true;
      }

      // 2. Catalog items via createCatalogOrder (legacy, header-only).
      if (catalogItems.length > 0) {
        const catalogGroups = supplierGroups.filter((g) =>
          g.items.some((it) => isCatalogItem(it.productId))
        );
        const catalogTotal = catalogItems.reduce(
          (s, it) => s + it.unitPrice * it.quantity, 0);

        const res = await createCatalogOrder({
          total:         catalogTotal,
          supplierCount: catalogGroups.length,
          itemCount:     catalogItems.length,
          summary:       summaryLines.join("\n"),
        });
        if (!res.ok) {
          toast(`Errore ordine catalogo: ${res.error}`);
          return;
        }
        anyOk = true;
      }

      if (!anyOk) {
        toast("Errore: nessun ordine inviato");
        return;
      }

      toast("Ordine inviato con successo!");
      clearCart();
      try {
        localStorage.removeItem("gb.typical-order");
      } catch {
        /* ignore */
      }
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
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Carrello"
        subtitle={`${items.length} prodotti da ${supplierGroups.length} fornitori.`}
        actions={
          <Button variant="ghost" size="md" density="compact" onClick={clearCart}>
            <Trash2 className="h-4 w-4" /> Svuota
          </Button>
        }
      />


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items by supplier */}
        <div className="lg:col-span-2 space-y-6">
          {supplierGroups.map((group) => (
            <Card key={group.supplierId}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-charcoal">{group.supplierName}</h3>
                <span className="text-sm font-mono font-bold text-forest">
                  {formatCurrency(group.subtotal)}
                </span>
              </div>
              {group.isBelowMinimum && (
                <div className="flex items-center gap-2 bg-terracotta-light rounded-xl p-3 mb-4 text-sm text-terracotta">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Ordine minimo: {formatCurrency(group.minOrderAmount ?? 0)}
                </div>
              )}
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-4 py-2 border-t border-sage-muted/20 first:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-charcoal text-sm truncate">{item.name}</p>
                      <p className="text-xs text-sage">
                        {formatCurrency(item.unitPrice)}/{formatUnitShort(item.unit as UnitType)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.productId, Math.max(item.minQuantity, item.quantity - 1))}
                        className="p-1 rounded-lg hover:bg-sage-muted/30"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="p-1 rounded-lg hover:bg-sage-muted/30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="font-mono font-bold text-sm w-20 text-right">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-sage hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <div>
          <Card className="sticky top-20">
            <h3 className="font-bold text-charcoal mb-4">Riepilogo Ordine</h3>
            {supplierGroups.map((g) => (
              <div key={g.supplierId} className="flex justify-between text-sm py-1">
                <span className="text-sage truncate">{g.supplierName}</span>
                <span className="font-mono">{formatCurrency(g.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-sage-muted/30 mt-3 pt-3 flex justify-between">
              <span className="font-bold text-charcoal">Totale</span>
              <span className="font-mono font-bold text-xl text-forest">{formatCurrency(totalAmount)}</span>
            </div>
            <p className="text-xs text-sage mt-2 mb-4">
              L&apos;ordine verra suddiviso in {supplierGroups.length} consegne separate.
            </p>
            <Button className="w-full" size="lg" onClick={handleCheckout} disabled={pending}>
              {pending ? "Invio in corso..." : "Conferma Ordine"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
