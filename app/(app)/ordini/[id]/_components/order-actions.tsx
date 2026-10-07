"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useCart } from "@/lib/hooks/useCart";
import { cancelOrderByRestaurant } from "@/lib/orders/restaurant-actions";
import type { UnitType } from "@/types/database";

export type ReorderLine = {
  productId: string;
  supplierId: string;
  supplierName: string;
  name: string;
  brand: string | null;
  unit: string;
  /** Current list price; null when the product is no longer available. */
  unitPrice: number | null;
  quantity: number;
  imageUrl: string | null;
  minQuantity: number;
};

/** "Riordina" (re-add the order's lines to the cart) and "Annulla ordine". */
export function OrderActions({
  orderId,
  reorderLines,
  canCancel,
}: {
  orderId: string;
  reorderLines: ReorderLine[];
  canCancel: boolean;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const { confirm, dialog } = useConfirm();
  const [pending, startTransition] = useTransition();

  function reorder() {
    let added = 0;
    let skipped = 0;
    for (const l of reorderLines) {
      if (l.unitPrice === null) {
        skipped += 1;
        continue;
      }
      addItem({
        productId: l.productId,
        supplierId: l.supplierId,
        supplierName: l.supplierName,
        name: l.name,
        brand: l.brand,
        unit: l.unit as UnitType,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        imageUrl: l.imageUrl,
        minQuantity: l.minQuantity,
      });
      added += 1;
    }
    if (added === 0) {
      toast.error("Nessun prodotto di questo ordine è ancora disponibile");
      return;
    }
    if (skipped > 0) {
      toast.warning(
        `${added} prodott${added === 1 ? "o aggiunto" : "i aggiunti"} al carrello, ${skipped} non più disponibil${skipped === 1 ? "e" : "i"}`,
      );
    } else {
      toast.success("Prodotti aggiunti al carrello ai prezzi attuali");
    }
    router.push("/carrello");
  }

  function cancel() {
    startTransition(async () => {
      const ok = await confirm({
        title: "Annullare l'ordine?",
        description: "I fornitori non l'hanno ancora preso in carico. L'operazione non si può annullare.",
        confirmLabel: "Annulla ordine",
        cancelLabel: "Indietro",
        tone: "danger",
      });
      if (!ok) return;
      const res = await cancelOrderByRestaurant(orderId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Ordine annullato");
      router.refresh();
    });
  }

  if (reorderLines.length === 0 && !canCancel) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reorderLines.length > 0 && (
        <Button size="sm" onClick={reorder}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Riordina
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="secondary" isLoading={pending} onClick={cancel}>
          <XCircle className="h-4 w-4" aria-hidden /> Annulla ordine
        </Button>
      )}
      {dialog}
    </div>
  );
}
