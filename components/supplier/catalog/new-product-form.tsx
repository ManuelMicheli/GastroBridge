"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { createProduct } from "@/lib/supplier/catalog/actions";

const UNIT_OPTIONS = [
  { value: "kg", label: "Chilogrammo (kg)" },
  { value: "g", label: "Grammo (g)" },
  { value: "lt", label: "Litro (lt)" },
  { value: "ml", label: "Millilitro (ml)" },
  { value: "pz", label: "Pezzo (pz)" },
  { value: "cartone", label: "Cartone" },
  { value: "bottiglia", label: "Bottiglia" },
  { value: "latta", label: "Latta" },
  { value: "confezione", label: "Confezione" },
];

type Props = {
  supplierId: string;
  categories: Array<{ id: string; name: string }>;
};

export function NewProductForm({ supplierId, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const name = String(form.get("name") ?? "").trim();
    const categoryId = String(form.get("category_id") ?? "");
    const unit = String(form.get("unit") ?? "");
    const priceRaw = String(form.get("price") ?? "");
    const price = Number(priceRaw);

    if (!name || !categoryId || !unit || !priceRaw || Number.isNaN(price)) {
      setError("Nome, categoria, unità e prezzo sono obbligatori.");
      return;
    }

    startTransition(async () => {
      const result = await createProduct({
        supplier_id: supplierId,
        category_id: categoryId,
        name,
        brand: (form.get("brand") as string) || null,
        description: (form.get("description") as string) || null,
        sku: (form.get("sku") as string) || null,
        unit: unit as
          | "kg"
          | "g"
          | "lt"
          | "ml"
          | "pz"
          | "cartone"
          | "bottiglia"
          | "latta"
          | "confezione",
        price,
        min_quantity: Number(form.get("min_quantity") ?? 1) || 1,
        is_available: true,
        lead_time_days: Number(form.get("lead_time_days") ?? 0) || 0,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Prodotto aggiunto");
      router.push(`/supplier/catalogo/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        name="name"
        label="Nome prodotto"
        placeholder="Es. Pomodori Pelati San Marzano"
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          name="category_id"
          label="Categoria"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          required
        />
        <Input name="brand" label="Brand" placeholder="Es. Mutti" />
      </div>
      <Input name="sku" label="SKU" placeholder="Codice interno (opzionale)" />
      <div className="grid grid-cols-2 gap-4">
        <Select name="unit" label="Unità di misura" options={UNIT_OPTIONS} />
        <Input
          name="price"
          label="Prezzo (€)"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="0,00"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          name="min_quantity"
          label="Quantità minima"
          type="number"
          step="0.5"
          min="0.5"
          defaultValue="1"
        />
        <Input
          name="lead_time_days"
          label="Lead time (giorni)"
          type="number"
          min="0"
          defaultValue="0"
        />
      </div>
      <Input
        name="description"
        label="Descrizione"
        placeholder="Descrizione del prodotto…"
      />

      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" isLoading={isPending}>
          Salva prodotto
        </Button>
        <Link href="/supplier/catalogo">
          <Button variant="secondary" type="button">
            Annulla
          </Button>
        </Link>
      </div>
    </form>
  );
}
