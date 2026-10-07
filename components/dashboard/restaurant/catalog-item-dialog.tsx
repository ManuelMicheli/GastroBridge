"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalogItem, updateCatalogItem } from "@/lib/catalogs/actions";
import { Modal, ModalActions } from "@/components/ui/modal";

type ItemData = { id: string; product_name: string; unit: string; price: number; notes: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  catalogId: string;
  item?: ItemData | null;
  onSaved?: () => void;
};

export function CatalogItemDialog({ open, onClose, catalogId, item, onSaved }: Props) {
  const [name, setName]     = useState(item?.product_name ?? "");
  const [unit, setUnit]     = useState(item?.unit ?? "");
  const [price, setPrice]   = useState<string>(item?.price?.toString() ?? "");
  const [notes, setNotes]   = useState(item?.notes ?? "");
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const submit = () => {
    const p = Number(price.replace(",", "."));
    if (!Number.isFinite(p) || p < 0) { toast.error("Prezzo non valido"); return; }

    startTransition(async () => {
      const payload = {
        product_name: name.trim(),
        unit:         unit.trim(),
        price:        p,
        notes:        notes.trim() || null,
      };
      const res = item
        ? await updateCatalogItem(item.id, catalogId, payload)
        : await createCatalogItem(catalogId, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(item ? "Prodotto aggiornato" : "Prodotto aggiunto");
      onSaved?.();
      onClose();
    });
  };

  const disabled = pending || name.trim().length === 0 || unit.trim().length === 0 || price.trim().length === 0;

  return (
    <Modal isOpen={open} onClose={onClose} title={item ? "Modifica prodotto" : "Nuovo prodotto"} size="sm">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) submit();
        }}
      >
        <label className="block">
          <span className="f-label">Nome *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="f-input mt-1.5" data-autofocus />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="f-label">Unità *</span>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className="f-input mt-1.5" placeholder="kg / L / pz" />
          </label>
          <label className="block">
            <span className="f-label">Prezzo (€) *</span>
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="f-input mt-1.5" />
          </label>
        </div>
        <label className="block">
          <span className="f-label">Note</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="f-input mt-1.5" />
        </label>
        <ModalActions>
          <button type="button" onClick={onClose} disabled={pending} className="f-btn f-btn-sm f-btn-outline">
            Annulla
          </button>
          <button type="submit" disabled={disabled} className="f-btn f-btn-sm f-btn-primary">
            {pending ? "Salvo..." : "Salva"}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
