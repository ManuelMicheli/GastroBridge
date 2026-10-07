"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalog, updateCatalog } from "@/lib/catalogs/actions";
import type { CatalogRow } from "@/lib/catalogs/types";
import { Modal, ModalActions } from "@/components/ui/modal";

type Props = {
  open: boolean;
  onClose: () => void;
  catalog?: CatalogRow | null;
  onSaved?: (catalog?: CatalogRow) => void;
};

/** "Nuovo catalogo" — Fernly modal (dimmed blur backdrop, scale-in panel). */
export function CatalogFormDialog({ open, onClose, catalog, onSaved }: Props) {
  const [supplierName, setSupplierName] = useState(catalog?.supplier_name ?? "");
  const [notes, setNotes]               = useState(catalog?.notes ?? "");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const payload = {
        supplier_name:    supplierName.trim(),
        delivery_days:    null,
        min_order_amount: null,
        notes:            notes.trim() || null,
      };
      const res = catalog
        ? await updateCatalog(catalog.id, payload)
        : await createCatalog(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(
        catalog
          ? "Catalogo aggiornato"
          : `“${payload.supplier_name}” aggiunto ai fornitori`,
      );
      onSaved?.(catalog ? undefined : (res.data as CatalogRow | undefined));
      onClose();
    });
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={catalog ? "Modifica catalogo" : "Nuovo catalogo"}
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && supplierName.trim().length > 0) submit();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="f-label">Nome fornitore *</span>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="f-input mt-1.5"
            placeholder="Es. Metro Italia"
            data-autofocus
          />
        </label>

        <label className="block">
          <span className="f-label">Note</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="f-input mt-1.5 !h-auto py-3"
            placeholder="Contatto, agente, orari..."
          />
        </label>

        <ModalActions>
          <button type="button" onClick={onClose} className="f-btn f-btn-sm f-btn-outline" disabled={pending}>
            Annulla
          </button>
          <button
            type="submit"
            disabled={pending || supplierName.trim().length === 0}
            className="f-btn f-btn-sm f-btn-primary"
          >
            {pending ? "Salvo..." : catalog ? "Salva" : "Aggiungi catalogo"}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
