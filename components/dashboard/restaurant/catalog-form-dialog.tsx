"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalog, updateCatalog } from "@/lib/catalogs/actions";
import type { CatalogRow } from "@/lib/catalogs/types";

type Props = {
  open: boolean;
  onClose: () => void;
  catalog?: CatalogRow | null;
  onSaved?: (catalog?: CatalogRow) => void;
};

export function CatalogFormDialog({ open, onClose, catalog, onSaved }: Props) {
  const [supplierName, setSupplierName] = useState(catalog?.supplier_name ?? "");
  const [deliveryDays, setDeliveryDays] = useState<string>(catalog?.delivery_days?.toString() ?? "");
  const [minOrder, setMinOrder]         = useState<string>(catalog?.min_order_amount?.toString() ?? "");
  const [notes, setNotes]               = useState(catalog?.notes ?? "");
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const parseOptionalNumber = (raw: string): number | null | undefined => {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : undefined; // undefined → invalid
  };

  const submit = () => {
    const dd = parseOptionalNumber(deliveryDays);
    const mo = parseOptionalNumber(minOrder);
    if (dd === undefined) { toast.error("Giorni di consegna non validi"); return; }
    if (mo === undefined) { toast.error("Importo minimo non valido"); return; }

    startTransition(async () => {
      const payload = {
        supplier_name:    supplierName.trim(),
        delivery_days:    dd === null ? null : Math.round(dd),
        min_order_amount: mo,
        notes:            notes.trim() || null,
      };
      const res = catalog
        ? await updateCatalog(catalog.id, payload)
        : await createCatalog(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(catalog ? "Catalogo aggiornato" : "Catalogo creato");
      onSaved?.(catalog ? undefined : (res.data as CatalogRow | undefined));
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {catalog ? "Modifica catalogo" : "Nuovo catalogo"}
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Nome fornitore *</span>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Es. Metro Italia"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-text-secondary">Consegna (gg)</span>
              <input
                type="number" inputMode="numeric" min={0}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-text-secondary">Min. ordine (€)</span>
              <input
                type="number" inputMode="decimal" min={0} step="0.01"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
                placeholder="150"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-text-secondary">Note</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="Contatto, agente, orari..."
            />
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
            disabled={pending || supplierName.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
          >
            {pending ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
