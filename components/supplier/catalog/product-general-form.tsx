"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { updateProductBase } from "@/lib/supplier/catalog/actions";
import type { ProductBasePatch } from "@/lib/supplier/catalog/schemas";

type WarehouseOption = { id: string; name: string };

type ProductBaseData = {
  name: string;
  description: string | null;
  brand: string | null;
  sku: string | null;
  price: number;
  is_available: boolean;
  lead_time_days: number;
  default_warehouse_id: string | null;
  hazard_class: string | null;
  tax_rate: number;
};

export default function ProductGeneralForm({
  productId,
  initial,
  warehouses,
}: {
  productId: string;
  initial: ProductBaseData;
  warehouses: WarehouseOption[];
}) {
  const [form, setForm] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    brand: initial.brand ?? "",
    sku: initial.sku ?? "",
    price: String(initial.price ?? 0),
    is_available: initial.is_available ?? true,
    lead_time_days: String(initial.lead_time_days ?? 0),
    default_warehouse_id: initial.default_warehouse_id ?? "",
    hazard_class: initial.hazard_class ?? "",
    tax_rate: String(initial.tax_rate ?? 0),
  });
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const priceNum = Number(form.price);
    const taxNum = Number(form.tax_rate);
    const leadNum = parseInt(form.lead_time_days, 10);

    if (!form.name.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error("Prezzo non valido");
      return;
    }
    if (!Number.isFinite(taxNum) || taxNum < 0 || taxNum > 100) {
      toast.error("Aliquota IVA non valida (0-100)");
      return;
    }
    if (!Number.isFinite(leadNum) || leadNum < 0) {
      toast.error("Giorni di lead time non validi");
      return;
    }

    const patch: ProductBasePatch = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      brand: form.brand.trim() || null,
      sku: form.sku.trim() || null,
      price: priceNum,
      is_available: form.is_available,
      lead_time_days: leadNum,
      default_warehouse_id: form.default_warehouse_id || null,
      hazard_class: form.hazard_class.trim() || null,
      tax_rate: taxNum,
    };

    startTransition(async () => {
      const res = await updateProductBase(productId, patch);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Prodotto aggiornato");
    });
  }

  const warehouseOptions = [
    { value: "", label: "— Nessuno —" },
    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
  ];

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome prodotto *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            disabled={isPending}
          />
          <Input
            label="Brand"
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            disabled={isPending}
          />
        </div>

        <Input
          label="Descrizione"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          disabled={isPending}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            disabled={isPending}
          />
          <Input
            label="Prezzo base (€) *"
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            required
            disabled={isPending}
          />
          <Input
            label="Aliquota IVA (%)"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.tax_rate}
            onChange={(e) =>
              setForm((f) => ({ ...f, tax_rate: e.target.value }))
            }
            disabled={isPending}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Lead time (giorni)"
            type="number"
            step="1"
            min="0"
            value={form.lead_time_days}
            onChange={(e) =>
              setForm((f) => ({ ...f, lead_time_days: e.target.value }))
            }
            disabled={isPending}
          />
          <Select
            label="Magazzino default"
            options={warehouseOptions}
            value={form.default_warehouse_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_warehouse_id: e.target.value }))
            }
            disabled={isPending}
          />
          <Input
            label="Classe di pericolo"
            value={form.hazard_class}
            onChange={(e) =>
              setForm((f) => ({ ...f, hazard_class: e.target.value }))
            }
            placeholder="Es. ADR 3"
            disabled={isPending}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm font-semibold text-charcoal">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_available: e.target.checked }))
            }
            disabled={isPending}
            className="h-4 w-4 accent-forest"
          />
          Prodotto attivo e visibile nel catalogo
        </label>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-sage-muted/30">
          {isPending && (
            <span className="text-sm text-sage inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Salvataggio…
            </span>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvataggio…" : "Salva generali"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
