"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createWarehouse,
  updateWarehouse,
} from "@/lib/supplier/warehouses/actions";
import type { Database } from "@/types/database";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];

type Props = {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  warehouse?: WarehouseRow | null;
  hasPrimary: boolean;
  onSaved?: () => void;
};

export function WarehouseFormDialog({
  open,
  onClose,
  supplierId,
  warehouse,
  hasPrimary,
  onSaved,
}: Props) {
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [city, setCity] = useState(warehouse?.city ?? "");
  const [province, setProvince] = useState(warehouse?.province ?? "");
  const [zipCode, setZipCode] = useState(warehouse?.zip_code ?? "");
  const [isPrimary, setIsPrimary] = useState<boolean>(
    warehouse?.is_primary ?? !hasPrimary,
  );
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const submit = () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      toast.error("Il nome è obbligatorio");
      return;
    }

    // Se il magazzino è già primary e l'utente sta disattivando il flag, chiedi conferma
    if (warehouse?.is_primary && !isPrimary) {
      if (
        !confirm(
          "Stai rimuovendo il flag di sede principale. Un'altra sede dovrà essere principale. Continuare?",
        )
      ) {
        return;
      }
    }

    // Se stai impostando una nuova primary mentre ne esiste già una, conferma
    if (!warehouse?.is_primary && isPrimary && hasPrimary) {
      if (
        !confirm(
          "Impostare questa sede come principale rimuoverà il flag dall'attuale principale. Continuare?",
        )
      ) {
        return;
      }
    }

    startTransition(async () => {
      const payload = {
        name: trimmedName,
        address: address.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        zip_code: zipCode.trim() || null,
        is_primary: isPrimary,
        is_active: warehouse?.is_active ?? true,
      };
      const res = warehouse
        ? await updateWarehouse(supplierId, warehouse.id, payload)
        : await createWarehouse(supplierId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(warehouse ? "Sede aggiornata" : "Sede creata");
      onSaved?.();
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {warehouse ? "Modifica sede" : "Nuova sede"}
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Nome *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Es. Deposito Nord"
            />
          </label>

          <label className="block">
            <span className="text-sm text-text-secondary">Indirizzo</span>
            <input
              type="text"
              value={address ?? ""}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Via Roma 10"
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block col-span-2">
              <span className="text-sm text-text-secondary">Città</span>
              <input
                type="text"
                value={city ?? ""}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              />
            </label>

            <label className="block">
              <span className="text-sm text-text-secondary">Prov.</span>
              <input
                type="text"
                value={province ?? ""}
                maxLength={4}
                onChange={(e) =>
                  setProvince(e.target.value.toUpperCase())
                }
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="MI"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-text-secondary">CAP</span>
            <input
              type="text"
              value={zipCode ?? ""}
              maxLength={10}
              onChange={(e) => setZipCode(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="20100"
            />
          </label>

          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-text-secondary">
              Sede principale
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover"
            disabled={pending}
          >
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={pending || name.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
          >
            {pending ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
