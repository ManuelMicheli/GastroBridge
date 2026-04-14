"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCatalogItem, updateCatalogItem } from "@/lib/catalogs/actions";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-surface-card border border-border-subtle p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          {item ? "Modifica prodotto" : "Nuovo prodotto"}
        </h2>
        <label className="block">
          <span className="text-sm text-text-secondary">Nome *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-text-secondary">Unità *</span>
            <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
              placeholder="kg / L / pz" />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Prezzo (€) *</span>
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-text-secondary">Note</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={pending}
            className="px-4 py-2 rounded-lg text-text-secondary hover:bg-surface-hover">Annulla</button>
          <button onClick={submit}
            disabled={pending || name.trim().length === 0 || unit.trim().length === 0 || price.trim().length === 0}
            className="px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50">
            {pending ? "Salvo..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
