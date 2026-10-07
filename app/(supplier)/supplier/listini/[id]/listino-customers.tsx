"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { assignCustomer, unassignCustomer } from "@/lib/supplier/pricing/actions";

export type ListinoCustomer = {
  restaurantId: string;
  name: string;
  /** restaurant_suppliers.id, to link the client page (null if no relationship). */
  relationshipId: string | null;
};

export type AssignableCustomer = ListinoCustomer & {
  /** Name of the list currently assigned to this client, if any. */
  currentListName: string | null;
};

/**
 * Clients that buy with this price list (customer_price_assignments).
 * A client has at most one assigned list per supplier: assigning here moves
 * it from its previous list.
 */
export function ListinoCustomers({
  supplierId,
  priceListId,
  canEdit,
  assigned,
  assignable,
}: {
  supplierId: string;
  priceListId: string;
  canEdit: boolean;
  assigned: ListinoCustomer[];
  assignable: AssignableCustomer[];
}) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  function assign() {
    const target = assignable.find((c) => c.restaurantId === selected);
    if (!target) return;
    startTransition(async () => {
      if (target.currentListName) {
        const ok = await confirm({
          title: `Spostare ${target.name} su questo listino?`,
          description: `Oggi usa il listino "${target.currentListName}".`,
          confirmLabel: "Sposta",
        });
        if (!ok) return;
      }
      const res = await assignCustomer(supplierId, {
        restaurant_id: target.restaurantId,
        price_list_id: priceListId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${target.name} assegnato al listino`);
      setSelected("");
      router.refresh();
    });
  }

  function remove(c: ListinoCustomer) {
    startTransition(async () => {
      const res = await unassignCustomer(supplierId, c.restaurantId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${c.name} torna al listino predefinito`);
      router.refresh();
    });
  }

  return (
    <Card className="mt-6">
      <h2 className="text-[17px] font-medium text-[var(--f-ink)]">
        Clienti assegnati · {assigned.length}
      </h2>
      <p className="mt-1 text-sm text-[var(--f-muted)]">
        I clienti assegnati ordinano con i prezzi di questo listino. Gli altri
        usano il listino predefinito.
      </p>

      {assigned.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--f-line)]">
          {assigned.map((c) => (
            <li key={c.restaurantId} className="flex items-center justify-between gap-3 py-2.5">
              {c.relationshipId ? (
                <Link
                  href={`/supplier/clienti/${c.relationshipId}`}
                  className="text-sm font-medium text-[var(--f-ink)] hover:underline"
                >
                  {c.name}
                </Link>
              ) : (
                <span className="text-sm font-medium text-[var(--f-ink)]">{c.name}</span>
              )}
              {canEdit && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(c)}>
                  Rimuovi
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--f-muted)]">Nessun cliente assegnato.</p>
      )}

      {canEdit && assignable.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <Select
              label="Assegna un cliente"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              placeholder="Scegli un cliente attivo"
              options={assignable.map((c) => ({
                value: c.restaurantId,
                label: c.currentListName ? `${c.name} (ora: ${c.currentListName})` : c.name,
              }))}
            />
          </div>
          <Button size="sm" isLoading={pending} disabled={!selected} onClick={assign}>
            Assegna
          </Button>
        </div>
      )}
      {dialog}
    </Card>
  );
}
