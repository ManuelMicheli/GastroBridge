"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, BookMarked, Plus, Trash2, ShoppingBasket } from "lucide-react";

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

      <TypicalOrderSection groups={groups} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Il tuo ordine tipico" — basket of recurring items optimized across catalogs.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gb.typical-order";

type OrderLine = { key: string; productName: string; unit: string; qty: number };

function TypicalOrderSection({ groups }: { groups: Group[] }) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pickKey, setPickKey] = useState("");
  const [qty, setQty] = useState("1");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderLine[];
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const groupByKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.key, g);
    return m;
  }, [groups]);

  const addLine = () => {
    const g = groupByKey.get(pickKey);
    if (!g) return;
    const q = Number(qty.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === g.key);
      if (existing) {
        return prev.map((l) => (l.key === g.key ? { ...l, qty: l.qty + q } : l));
      }
      return [...prev, { key: g.key, productName: g.productName, unit: g.unit, qty: q }];
    });
    setPickKey("");
    setQty("1");
  };

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateQty = (key: string, raw: string) => {
    const q = Number(raw.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: q } : l)));
  };

  // Compute best-price + per-supplier totals
  type Computed = {
    line: OrderLine;
    available: boolean;
    bestPrice: number | null;
    bestSupplier: SupplierLite | null;
    bestLineTotal: number;
  };
  const computed: Computed[] = lines.map((line) => {
    const g = groupByKey.get(line.key);
    if (!g || g.offers.length === 0) {
      return { line, available: false, bestPrice: null, bestSupplier: null, bestLineTotal: 0 };
    }
    const cheapest = g.offers[0]!; // offers already sorted ASC
    return {
      line,
      available: true,
      bestPrice: cheapest.price,
      bestSupplier: cheapest.supplier,
      bestLineTotal: cheapest.price * line.qty,
    };
  });

  const basketOptimal = computed.reduce((s, c) => s + c.bestLineTotal, 0);

  // Per-supplier total: would the user buy everything from one supplier?
  const supplierIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) for (const o of g.offers) set.add(o.supplier.id);
    return Array.from(set);
  }, [groups]);

  const perSupplier = supplierIds
    .map((sid) => {
      const g0 = groups.find((g) => g.offers.some((o) => o.supplier.id === sid));
      const supplierName = g0?.offers.find((o) => o.supplier.id === sid)?.supplier.supplier_name ?? "";
      let total = 0;
      let coveredItems = 0;
      for (const line of lines) {
        const g = groupByKey.get(line.key);
        const offer = g?.offers.find((o) => o.supplier.id === sid);
        if (offer) {
          total += offer.price * line.qty;
          coveredItems += 1;
        }
      }
      return { id: sid, name: supplierName, total, coveredItems };
    })
    .filter((s) => s.coveredItems > 0)
    .sort((a, b) => {
      // Prefer suppliers that cover all items, then by price
      if (a.coveredItems !== b.coveredItems) return b.coveredItems - a.coveredItems;
      return a.total - b.total;
    });

  return (
    <section className="mt-12 border-t border-border-subtle pt-8">
      <header className="flex items-center gap-2 mb-2">
        <ShoppingBasket className="h-5 w-5 text-accent-green" />
        <h2 className="text-xl font-semibold text-text-primary">Il tuo ordine tipico</h2>
      </header>
      <p className="text-sm text-text-secondary mb-4">
        Aggiungi i prodotti che acquisti regolarmente con la quantità: vedi subito il prezzo migliore per riga e il totale del basket ottimale.
      </p>

      {/* Add row */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <label className="block flex-1 min-w-[200px]">
          <span className="text-xs text-text-tertiary">Prodotto</span>
          <select
            value={pickKey}
            onChange={(e) => setPickKey(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          >
            <option value="">— scegli un prodotto —</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.productName} ({g.unit})
              </option>
            ))}
          </select>
        </label>
        <label className="block w-24">
          <span className="text-xs text-text-tertiary">Quantità</span>
          <input
            type="number" min={0} step="0.1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary"
          />
        </label>
        <button
          onClick={addLine}
          disabled={!pickKey}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Aggiungi
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-text-tertiary py-6 text-center border border-dashed border-border-subtle rounded-lg">
          Nessun prodotto nell&apos;ordine tipico. Aggiungine uno qui sopra.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-border-subtle overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-card text-text-tertiary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Prodotto</th>
                  <th className="text-right px-3 py-2 font-medium">Q.tà</th>
                  <th className="text-left px-3 py-2 font-medium">Unità</th>
                  <th className="text-right px-3 py-2 font-medium">Miglior prezzo</th>
                  <th className="text-left px-3 py-2 font-medium">Fornitore</th>
                  <th className="text-right px-3 py-2 font-medium">Totale riga</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {computed.map(({ line, available, bestPrice, bestSupplier, bestLineTotal }) => (
                  <tr key={line.key} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-text-primary">{line.productName}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" min={0} step="0.1"
                        value={line.qty}
                        onChange={(e) => updateQty(line.key, e.target.value)}
                        className="w-20 rounded bg-surface-base border border-border-subtle px-2 py-1 text-right text-text-primary tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{line.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {available
                        ? <span className="text-accent-green font-medium">€ {bestPrice!.toFixed(2)}</span>
                        : <span className="text-text-tertiary">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {available && bestSupplier
                        ? <Link href={`/cataloghi/${bestSupplier.id}`} className="text-accent-green hover:underline">{bestSupplier.supplier_name}</Link>
                        : <span className="text-text-tertiary text-xs">non disponibile</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">
                      {available ? <>€ {bestLineTotal.toFixed(2)}</> : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-400" title="Rimuovi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-card">
                <tr className="border-t border-border-subtle">
                  <td colSpan={5} className="px-3 py-2 font-medium text-text-primary text-right">
                    Basket ottimale (split su più fornitori)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-accent-green font-semibold">
                    € {basketOptimal.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Single-supplier comparison */}
          {perSupplier.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">
                Se comprassi tutto da un solo fornitore:
              </h3>
              <ul className="rounded-xl border border-border-subtle divide-y divide-border-subtle">
                {perSupplier.map((s) => {
                  const isFull = s.coveredItems === lines.length;
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-text-secondary">
                        <Link href={`/cataloghi/${s.id}`} className="hover:underline text-text-primary">{s.name}</Link>
                        {!isFull && (
                          <span className="ml-2 text-xs text-text-tertiary">
                            (copre {s.coveredItems}/{lines.length})
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-text-primary">
                        € {s.total.toFixed(2)}
                        {isFull && s.total > basketOptimal && (
                          <span className="ml-2 text-xs text-text-tertiary">
                            (+€ {(s.total - basketOptimal).toFixed(2)} vs split)
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
