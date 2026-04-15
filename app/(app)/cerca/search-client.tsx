"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, BookMarked } from "lucide-react";

export type SupplierLite = { id: string; supplier_name: string };
export type CatalogItemLite = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
  notes: string | null;
};

type Group = {
  key: string;
  productName: string;
  unit: string;
  offers: { supplier: SupplierLite; price: number; itemId: string }[];
};

type Props = {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
};

export function SearchPageClient({ suppliers, items }: Props) {
  const [query, setQuery] = useState("");

  const supplierById = useMemo(() => {
    const m = new Map<string, SupplierLite>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const key = `${it.product_name_normalized}::${it.unit}`;
      let g = map.get(key);
      if (!g) {
        g = { key, productName: it.product_name, unit: it.unit, offers: [] };
        map.set(key, g);
      }
      g.offers.push({ supplier, price: it.price, itemId: it.id });
    }
    for (const g of map.values()) g.offers.sort((a, b) => a.price - b.price);
    return Array.from(map.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName, "it"),
    );
  }, [items, supplierById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.productName.toLowerCase().includes(q));
  }, [groups, query]);

  if (suppliers.length === 0) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">Cerca prodotti</h1>
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <BookMarked className="mx-auto h-8 w-8 text-text-tertiary" />
          <h2 className="mt-3 text-lg font-medium text-text-primary">Nessun catalogo ancora</h2>
          <p className="mt-1 text-sm text-text-secondary">
            La ricerca confronta i prodotti tra i tuoi cataloghi fornitore. Crea il primo catalogo per iniziare.
          </p>
          <Link
            href="/cataloghi"
            className="mt-4 inline-flex px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium"
          >
            Vai ai cataloghi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Cerca prodotti</h1>
        <p className="text-sm text-text-secondary">
          Trova il prezzo più basso tra i tuoi {suppliers.length} cataloghi fornitore.
        </p>
      </header>

      <div className="relative max-w-xl">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
        <input
          autoFocus
          type="search"
          placeholder="Es. farina, olio, pomodoro..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg bg-surface-base border border-border-subtle pl-9 pr-3 py-2.5 text-text-primary"
        />
      </div>

      <p className="text-xs text-text-tertiary">
        {filtered.length} {filtered.length === 1 ? "prodotto" : "prodotti"}
        {query && ` per "${query}"`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary">
          {query
            ? <>Nessun prodotto contiene &quot;{query}&quot; nei tuoi cataloghi.</>
            : "Inizia a digitare per cercare."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => {
            const cheapest = g.offers[0];
            const cheapestPrice = cheapest?.price;
            return (
              <li key={g.key} className="rounded-xl bg-surface-card border border-border-subtle p-4">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-semibold text-text-primary">
                    {g.productName} <span className="text-xs text-text-tertiary font-normal">/ {g.unit}</span>
                  </h3>
                  {cheapest && (
                    <span className="text-sm text-text-secondary">
                      Migliore: <span className="text-accent-green font-medium">€ {cheapestPrice!.toFixed(2)}</span>
                      {" "}da {cheapest.supplier.supplier_name}
                    </span>
                  )}
                </div>
                <ul className="mt-3 divide-y divide-border-subtle">
                  {g.offers.map((o) => {
                    const isBest = o.price === cheapestPrice;
                    return (
                      <li key={o.itemId} className="flex items-center justify-between py-1.5 text-sm">
                        <Link
                          href={`/cataloghi/${o.supplier.id}`}
                          className={`hover:underline ${isBest ? "text-accent-green" : "text-text-secondary"}`}
                        >
                          {o.supplier.supplier_name}
                        </Link>
                        <span
                          className={`tabular-nums ${isBest ? "text-accent-green font-medium" : "text-text-primary"}`}
                        >
                          € {o.price.toFixed(2)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
