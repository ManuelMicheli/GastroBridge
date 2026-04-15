"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { upsertPriceListItems } from "@/lib/supplier/pricing/actions";
import type { AddCandidate } from "./page";

type Props = {
  listId: string;
  candidates: AddCandidate[];
};

export function AddProductsClient({ listId, candidates }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      candidates.map((c) => [
        `${c.product_id}::${c.sales_unit_id}`,
        c.suggested_price,
      ]),
    ),
  );
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.product_name.toLowerCase().includes(q) ||
        c.sales_unit_label.toLowerCase().includes(q) ||
        (c.product_brand?.toLowerCase().includes(q) ?? false),
    );
  }, [candidates, filter]);

  const allSelected =
    filtered.length > 0 &&
    filtered.every((c) =>
      selected.has(`${c.product_id}::${c.sales_unit_id}`),
    );

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const c of filtered) {
          next.delete(`${c.product_id}::${c.sales_unit_id}`);
        }
      } else {
        for (const c of filtered) {
          next.add(`${c.product_id}::${c.sales_unit_id}`);
        }
      }
      return next;
    });
  };

  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onPriceChange = (key: string, raw: string) => {
    const parsed = Number.parseFloat(raw.replace(",", "."));
    setPrices((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    }));
  };

  const submit = () => {
    const picked = candidates.filter((c) =>
      selected.has(`${c.product_id}::${c.sales_unit_id}`),
    );
    if (picked.length === 0) {
      toast.error("Seleziona almeno un prodotto");
      return;
    }
    const items = picked.map((c) => {
      const key = `${c.product_id}::${c.sales_unit_id}`;
      return {
        product_id: c.product_id,
        sales_unit_id: c.sales_unit_id,
        price: prices[key] ?? c.suggested_price ?? 0,
      };
    });
    startTransition(async () => {
      const res = await upsertPriceListItems(listId, items);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Aggiunti ${items.length} prodotti`);
      router.push(`/supplier/listini/${listId}`);
    });
  };

  if (candidates.length === 0) {
    return (
      <Card className="text-center py-16">
        <p className="text-text-secondary mb-4">
          Tutti i tuoi prodotti sono già nel listino.
        </p>
        <Link
          href={`/supplier/listini/${listId}`}
          className="text-accent-green hover:underline"
        >
          ← Torna all&apos;editor
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtra per nome/brand/unità…"
          className="flex-1 min-w-[200px] rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-sm text-text-primary"
        />
        <span className="text-sm text-text-secondary">
          {selected.size} selezionati su {candidates.length}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size === 0}
          className="px-4 py-2 rounded-lg bg-accent-green text-surface-base text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Aggiungo..." : `Aggiungi ${selected.size} righe`}
        </button>
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-base text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4"
                />
              </th>
              <th className="px-4 py-3">Prodotto</th>
              <th className="px-4 py-3">Unità</th>
              <th className="px-4 py-3 text-right">Prezzo iniziale</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const key = `${c.product_id}::${c.sales_unit_id}`;
              const isSel = selected.has(key);
              return (
                <tr
                  key={key}
                  className="border-t border-border-subtle hover:bg-surface-hover"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleOne(key)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">
                      {c.product_name}
                    </p>
                    {c.product_brand && (
                      <p className="text-xs text-text-secondary">
                        {c.product_brand}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {c.sales_unit_label}
                    {c.sales_unit_is_base && (
                      <span className="ml-1 text-[10px] uppercase text-accent-green">
                        base
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <span className="text-text-secondary text-sm">€</span>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={prices[key] ?? 0}
                        onChange={(e) => onPriceChange(key, e.target.value)}
                        className="w-28 rounded-lg bg-surface-base border border-border-subtle px-2 py-1.5 text-right font-mono text-sm text-text-primary focus:border-accent-green focus:outline-none"
                        disabled={!isSel}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
