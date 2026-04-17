"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import {
  upsertPriceListEntry,
  deletePriceListEntry,
} from "@/lib/price-lists/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { PriceListWithProduct } from "@/lib/price-lists/types";

type Product = { id: string; name: string; unit: string | null; price: number | null };

type Props = {
  relationshipId: string;
  products: Product[];
  initialEntries: PriceListWithProduct[];
};

type DraftEntry = {
  product_id: string;
  custom_price: string;
  custom_min_qty: string;
  valid_from: string;
  valid_to: string;
};

const EMPTY_DRAFT: DraftEntry = {
  product_id: "",
  custom_price: "",
  custom_min_qty: "",
  valid_from: "",
  valid_to: "",
};

export function PriceListEditor({ relationshipId, products, initialEntries }: Props) {
  const [draft, setDraft] = useState<DraftEntry>(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const usedProductIds = useMemo(
    () => new Set(initialEntries.map((e) => e.product_id)),
    [initialEntries],
  );
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id));

  function handleAdd() {
    const price = Number(draft.custom_price);
    if (!draft.product_id) return toast.error("Seleziona un prodotto");
    if (!Number.isFinite(price) || price < 0) return toast.error("Prezzo non valido");

    const minQty = draft.custom_min_qty.trim() === "" ? null : Number(draft.custom_min_qty);
    if (minQty !== null && (!Number.isFinite(minQty) || minQty <= 0)) {
      return toast.error("Quantità minima non valida");
    }

    startTransition(async () => {
      const res = await upsertPriceListEntry({
        relationship_id: relationshipId,
        product_id:      draft.product_id,
        custom_price:    price,
        custom_min_qty:  minQty ?? undefined,
        valid_from:      draft.valid_from || undefined,
        valid_to:        draft.valid_to   || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Voce aggiunta al listino");
      setDraft(EMPTY_DRAFT);
      router.refresh();
    });
  }

  function handleDelete(entryId: string) {
    startTransition(async () => {
      const res = await deletePriceListEntry(entryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Voce rimossa");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {availableProducts.length > 0 && (
        <Card>
          <h2 className="font-bold text-charcoal mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Aggiungi voce
          </h2>
          <div className="cq-section grid grid-cols-1 @[520px]:grid-cols-2 @[900px]:grid-cols-6 gap-3">
            <select
              value={draft.product_id}
              onChange={(e) => setDraft({ ...draft, product_id: e.target.value })}
              className="@[900px]:col-span-2 border-2 border-sage-muted rounded-xl py-2 px-3 text-sm"
            >
              <option value="">Prodotto…</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.unit ? `(${p.unit})` : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Prezzo €"
              value={draft.custom_price}
              onChange={(e) => setDraft({ ...draft, custom_price: e.target.value })}
              className="border-2 border-sage-muted rounded-xl py-2 px-3 text-sm"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Min qty"
              value={draft.custom_min_qty}
              onChange={(e) => setDraft({ ...draft, custom_min_qty: e.target.value })}
              className="border-2 border-sage-muted rounded-xl py-2 px-3 text-sm"
            />
            <input
              type="date"
              value={draft.valid_from}
              onChange={(e) => setDraft({ ...draft, valid_from: e.target.value })}
              className="border-2 border-sage-muted rounded-xl py-2 px-3 text-sm"
              title="Valido da"
            />
            <input
              type="date"
              value={draft.valid_to}
              onChange={(e) => setDraft({ ...draft, valid_to: e.target.value })}
              className="border-2 border-sage-muted rounded-xl py-2 px-3 text-sm"
              title="Valido fino a"
            />
          </div>
          <div className="mt-4">
            <Button size="sm" onClick={handleAdd} isLoading={isPending}>
              <Save className="h-4 w-4" /> Salva voce
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-bold text-charcoal mb-4">
          Voci attuali ({initialEntries.length})
        </h2>
        {initialEntries.length === 0 ? (
          <p className="text-sm text-sage">
            Nessuna voce. Aggiungi prodotti per definire prezzi personalizzati.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-sage uppercase">
                  <th className="px-3 py-2">Prodotto</th>
                  <th className="px-3 py-2 text-right">Prezzo listino</th>
                  <th className="px-3 py-2 text-right">Prezzo custom</th>
                  <th className="px-3 py-2 text-right">Min qty</th>
                  <th className="px-3 py-2">Valido</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {initialEntries.map((e) => {
                  const catalog = e.product ?? productById.get(e.product_id);
                  const baseline = catalog?.price != null ? Number(catalog.price) : null;
                  const diff =
                    baseline !== null
                      ? ((Number(e.custom_price) - baseline) / baseline) * 100
                      : null;
                  return (
                    <tr key={e.id} className="border-t border-sage-muted/20">
                      <td className="px-3 py-2 text-charcoal">
                        {catalog?.name ?? e.product_id}
                        {catalog?.unit && (
                          <span className="text-xs text-sage ml-1">({catalog.unit})</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-sage font-mono">
                        {baseline !== null ? `€ ${baseline.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-forest">
                        € {Number(e.custom_price).toFixed(2)}
                        {diff !== null && (
                          <span
                            className={`ml-2 text-xs font-normal ${
                              diff < 0 ? "text-forest" : diff > 0 ? "text-terracotta" : "text-sage"
                            }`}
                          >
                            {diff >= 0 ? "+" : ""}
                            {diff.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-sage">
                        {e.custom_min_qty !== null ? Number(e.custom_min_qty) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-sage">
                        {e.valid_from ?? "—"} → {e.valid_to ?? "∞"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          disabled={isPending}
                          title="Rimuovi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
