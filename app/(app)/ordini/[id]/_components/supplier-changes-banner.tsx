"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { respondToSupplierChanges } from "@/lib/orders/supplier-actions";

/**
 * In-app CTA for splits in `pending_customer_confirmation`: the supplier
 * changed quantities and waits for the restaurant. Same effect as the email
 * link (/ordini/[splitId]/conferma?token=…), authorized by ownership.
 */
export function SupplierChangesBanner({
  splitId,
  supplierName,
}: {
  splitId: string;
  supplierName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  function respond(accepted: boolean) {
    startTransition(async () => {
      if (!accepted) {
        const ok = await confirm({
          title: "Rifiutare le modifiche?",
          description: `L'ordine a ${supplierName} verrà annullato.`,
          confirmLabel: "Rifiuta e annulla",
          tone: "danger",
        });
        if (!ok) return;
      }
      const res = await respondToSupplierChanges(splitId, accepted);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        accepted
          ? res.data.splitStatus === "stock_conflict"
            ? "Modifiche accettate: il fornitore deve verificare la disponibilità"
            : "Modifiche accettate, ordine confermato"
          : "Modifiche rifiutate, ordine annullato",
      );
      router.refresh();
    });
  }

  return (
    <Card className="mb-4">
      <p className="text-sm font-medium text-text-primary">
        {supplierName} ha modificato il tuo ordine
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Le quantità sono cambiate rispetto alla tua richiesta. Conferma per
        procedere o rifiuta per annullare la parte di ordine di questo fornitore.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" isLoading={pending} onClick={() => respond(true)}>
          Accetta modifiche
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => respond(false)}
        >
          Rifiuta
        </Button>
      </div>
      {dialog}
    </Card>
  );
}
