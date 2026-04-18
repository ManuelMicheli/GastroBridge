"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Printer, ShoppingCart, AlertTriangle, Plus } from "lucide-react";
import { normalizeName, normalizeUnit } from "@/lib/catalogs/normalize";
import { useCart } from "@/lib/hooks/useCart";
import { toast } from "sonner";
import type { UnitType } from "@/types/database";
import {
  rankOffers,
  defaultPrefs,
  type Offer,
  type Preferences,
  type ScoredOffer,
} from "@/lib/scoring";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import { BreakdownTooltip } from "@/components/shared/scoring/breakdown-tooltip";

export type SupplierLite = {
  id: string;
  supplier_name: string;
  delivery_days: number | null;
  min_order_amount: number | null;
};
export type CatalogItemLite = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
};

/**
 * Build a minimal `Offer` from a catalog item + supplier for the scoring
 * engine. See the matching helper in search-client.tsx — fields absent
 * from imported catalogs get neutral defaults (standard tier, no certs,
 * macro=altro, not bio).
 */
function buildOffer(
  item: { id: string; product_name: string; unit: string; price: number },
  supplier: SupplierLite,
): Offer {
  return {
    id: item.id,
    supplierId: supplier.id,
    productName: item.product_name,
    unit: item.unit,
    price: item.price,
    qualityTier: "standard",
    isBio: false,
    leadTimeDays: supplier.delivery_days ?? 2,
    certifications: [],
    macroCategory: "altro",
    supplierMinOrder: supplier.min_order_amount ?? undefined,
  };
}

type OrderLine = { key: string; productName: string; unit: string; qty: number };

const STORAGE_KEY = "gb.typical-order";

type Pick = {
  itemId: string;
  /** OrderLine.key — used to wire alt-pick overrides back to the line. */
  lineKey: string;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  lineTotal: number;
  scored: ScoredOffer;
  /** Top-3 alternative picks for the same line (sorted by score desc). */
  alternatives: { itemId: string; supplierId: string; supplierName: string; price: number; scored: ScoredOffer }[];
  /** When true, all offers for this line failed hard constraints — the
   * pick is a fallback and the user should be warned. */
  fallback: boolean;
};

type SupplierBucket = {
  supplier: SupplierLite;
  picks: Pick[];
  subtotal: number;
};

export function OptimalCartClient({
  suppliers,
  items,
  preferences,
  connectedSupplierIds = [],
}: {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
  preferences: Preferences | null;
  /** supplier.id values that map to real `suppliers.id` (not `restaurant_catalogs.id`).
   *  Items from these suppliers carry real `products.id` UUIDs and go through
   *  the marketplace RPC flow (`submitOrder`); others use the legacy
   *  `createCatalogOrder` header-only path. */
  connectedSupplierIds?: string[];
}) {
  const prefs = preferences ?? defaultPrefs;
  const connectedSet = useMemo(() => new Set(connectedSupplierIds), [connectedSupplierIds]);
  const router = useRouter();
  const { addItem } = useCart();
  const [order, setOrder] = useState<OrderLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  /** Per-line override: line.key -> chosen itemId. Lets users swap to an
   * alternative offer without losing the ranking context. */
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderLine[];
        if (Array.isArray(parsed)) setOrder(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Index: (normName::unit) -> list of raw entries per supplier
  type Entry = { supplier: SupplierLite; item: CatalogItemLite };
  const entriesByKey = useMemo(() => {
    const supplierById = new Map<string, SupplierLite>();
    for (const s of suppliers) supplierById.set(s.id, s);

    const map = new Map<string, Entry[]>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const key = `${it.product_name_normalized}::${it.unit}`;
      const list = map.get(key) ?? [];
      list.push({ supplier, item: it });
      map.set(key, list);
    }
    return map;
  }, [items, suppliers]);

  // Fallback: name-only lookup
  const entriesByName = useMemo(() => {
    const supplierById = new Map<string, SupplierLite>();
    for (const s of suppliers) supplierById.set(s.id, s);
    const map = new Map<string, Entry[]>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const list = map.get(it.product_name_normalized) ?? [];
      list.push({ supplier, item: it });
      map.set(it.product_name_normalized, list);
    }
    return map;
  }, [items, suppliers]);

  // Build buckets per supplier from the user's typical order, using the
  // scoring engine to pick the highest-scored offer per line (honouring
  // the restaurant's preferences). When all offers fail hard constraints
  // we fall back to the cheapest, but flag the line.
  const { buckets, missing, grandTotal, averagePricePerLine } = useMemo(() => {
    const buckets = new Map<string, SupplierBucket>();
    const missing: { productName: string; unit: string; qty: number }[] = [];
    /** Average price (across candidate offers) per line.key — used to show
     * savings badges even when we fall back. */
    const averagePricePerLine = new Map<string, number>();

    for (const line of order) {
      const lookupKey = line.key.includes("::")
        ? line.key
        : `${normalizeName(line.productName)}::${normalizeUnit(line.unit)}`;
      let matches = entriesByKey.get(lookupKey);
      if (!matches || matches.length === 0) {
        const nameKey = lookupKey.split("::")[0] ?? normalizeName(line.productName);
        matches = entriesByName.get(nameKey);
      }
      if (!matches || matches.length === 0) {
        missing.push({ productName: line.productName, unit: line.unit, qty: line.qty });
        continue;
      }

      const offers: Offer[] = matches.map((e) => buildOffer(e.item, e.supplier));
      const result = rankOffers(offers, prefs);

      const entryByOfferId = new Map<string, Entry>();
      for (const e of matches) entryByOfferId.set(e.item.id, e);

      // Build scored list; if everything was excluded, synthesise a
      // cheapest-fallback ScoredOffer so the UI can still render a line.
      let orderedScored: ScoredOffer[] = result.included;
      let fallback = false;
      if (orderedScored.length === 0) {
        fallback = true;
        // Fallback: re-run scoring ignoring hard constraints by passing
        // neutral prefs; keep original weights for the breakdown.
        const neutral = rankOffers(offers, defaultPrefs);
        orderedScored = neutral.included;
      }

      const priceAvg =
        offers.length > 0
          ? offers.reduce((s, o) => s + o.price, 0) / offers.length
          : 0;
      averagePricePerLine.set(line.key, priceAvg);

      if (orderedScored.length === 0) continue; // nothing at all

      const override = overrides[line.key];
      const chosen =
        (override && orderedScored.find((s) => s.offer.id === override)) ??
        orderedScored[0];
      if (!chosen) continue;

      const chosenEntry = entryByOfferId.get(chosen.offer.id);
      if (!chosenEntry) continue;

      const alternatives = orderedScored
        .filter((s) => s.offer.id !== chosen.offer.id)
        .slice(0, 3)
        .map((s) => {
          const e = entryByOfferId.get(s.offer.id);
          return {
            itemId: s.offer.id,
            supplierId: e?.supplier.id ?? s.offer.supplierId,
            supplierName: e?.supplier.supplier_name ?? s.offer.supplierId,
            price: s.offer.price,
            scored: s,
          };
        });

      const lineTotal = chosen.offer.price * line.qty;
      let bucket = buckets.get(chosenEntry.supplier.id);
      if (!bucket) {
        bucket = { supplier: chosenEntry.supplier, picks: [], subtotal: 0 };
        buckets.set(chosenEntry.supplier.id, bucket);
      }
      bucket.picks.push({
        itemId: chosenEntry.item.id,
        lineKey: line.key,
        productName: line.productName,
        unit: chosenEntry.item.unit,
        qty: line.qty,
        price: chosen.offer.price,
        lineTotal,
        scored: chosen,
        alternatives,
        fallback,
      });
      bucket.subtotal += lineTotal;
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => b.subtotal - a.subtotal);
    const grandTotal = sorted.reduce((s, b) => s + b.subtotal, 0);
    return { buckets: sorted, missing, grandTotal, averagePricePerLine };
  }, [order, entriesByKey, entriesByName, prefs, overrides]);

  /** Total "baseline" = sum over lines of (avg offer price × qty). Compared
   * to grandTotal this shows savings vs picking a random-average offer. */
  const baselineTotal = useMemo(() => {
    let total = 0;
    for (const line of order) {
      const avg = averagePricePerLine.get(line.key) ?? 0;
      total += avg * line.qty;
    }
    return total;
  }, [order, averagePricePerLine]);
  const savingsVsAverage = Math.max(0, baselineTotal - grandTotal);

  const exportCsv = () => {
    const lines = ["Fornitore;Prodotto;Unità;Quantità;Prezzo;Totale riga"];
    for (const b of buckets) {
      for (const p of b.picks) {
        lines.push([
          quote(b.supplier.supplier_name),
          quote(p.productName),
          quote(p.unit),
          p.qty.toString(),
          p.price.toFixed(2),
          p.lineTotal.toFixed(2),
        ].join(";"));
      }
    }
    lines.push("");
    lines.push(`;;;;;Totale;${grandTotal.toFixed(2)}`);
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `carrello-ottimale-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!hydrated) {
    return <div className="p-6 text-text-tertiary">Caricamento ordine…</div>;
  }

  if (suppliers.length === 0) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">Carrello ottimale</h1>
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-text-tertiary" />
          <p className="mt-3 text-text-secondary">Devi prima creare almeno un catalogo fornitore.</p>
          <Link href="/cataloghi" className="mt-4 inline-flex px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium">
            Vai ai cataloghi
          </Link>
        </div>
      </div>
    );
  }

  if (order.length === 0) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <Link href="/cerca" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Torna a Cerca
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Carrello ottimale</h1>
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <ShoppingCart className="mx-auto h-8 w-8 text-text-tertiary" />
          <p className="mt-3 text-text-secondary">Il tuo ordine tipico è vuoto.</p>
          <Link href="/cerca" className="mt-4 inline-flex px-4 py-2 rounded-lg bg-accent-green text-surface-base font-medium">
            Compila l&apos;ordine tipico
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 print:p-0">
      <div className="print:hidden">
        <Link href="/cerca" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Torna a Cerca
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Carrello ottimale</h1>
          <p className="text-sm text-text-secondary mt-1">
            Per ogni prodotto è stato scelto il fornitore con il punteggio più alto secondo le tue preferenze. Ordini separati per fornitore.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover"
          >
            <Printer className="h-4 w-4" /> Stampa
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover"
          >
            <Download className="h-4 w-4" /> Esporta CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <SummaryStat label="Fornitori coinvolti" value={buckets.length.toString()} />
        <SummaryStat label="Articoli totali" value={buckets.reduce((s, b) => s + b.picks.length, 0).toString()} />
        <SummaryStat label="Totale carrello" value={`€ ${grandTotal.toFixed(2)}`} highlight />
      </div>

      {savingsVsAverage > 0 && (
        <div className="rounded-xl border border-accent-green/30 bg-accent-green/5 px-4 py-2 text-sm text-accent-green">
          Risparmio vs media: <span className="font-semibold">€ {savingsVsAverage.toFixed(2)}</span>
          {" "}rispetto a un&apos;offerta media per ciascun prodotto.
        </div>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <h3 className="text-sm font-medium text-yellow-400 inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {missing.length} prodotti non disponibili nei cataloghi
          </h3>
          <ul className="mt-2 text-sm text-text-secondary space-y-1">
            {missing.map((m, i) => (
              <li key={i}>• {m.productName} ({m.unit}) × {m.qty}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {buckets.map((b) => (
          <article
            key={b.supplier.id}
            className="rounded-xl bg-surface-card border border-border-subtle p-4 print:break-inside-avoid"
          >
            <header className="flex items-baseline justify-between gap-3 flex-wrap pb-3 border-b border-border-subtle">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  <Link href={`/cataloghi/${b.supplier.id}`} className="hover:underline">
                    {b.supplier.supplier_name}
                  </Link>
                </h2>
                <p className="text-xs text-text-tertiary">{b.picks.length} articoli</p>
              </div>
              <span className="text-lg font-semibold text-accent-green tabular-nums">
                € {b.subtotal.toFixed(2)}
              </span>
            </header>
            <table className="w-full text-sm mt-2">
              <thead className="text-text-tertiary">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">Prodotto</th>
                  <th className="text-right px-2 py-1 font-medium">Q.tà</th>
                  <th className="text-left px-2 py-1 font-medium">Unità</th>
                  <th className="text-right px-2 py-1 font-medium">Prezzo</th>
                  <th className="text-right px-2 py-1 font-medium">Totale</th>
                  <th className="text-left px-2 py-1 font-medium print:hidden">Alternative</th>
                </tr>
              </thead>
              <tbody>
                {b.picks.map((p, i) => (
                  <tr key={i} className="border-t border-border-subtle align-top">
                    <td className="px-2 py-1.5 text-text-primary" title={p.productName}>
                      {p.productName}
                      {p.fallback && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 text-[10px] text-yellow-500">
                          <AlertTriangle className="h-3 w-3" /> vincoli non rispettati
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-text-primary">{p.qty}</td>
                    <td className="px-2 py-1.5 text-text-secondary" title={p.unit}>{p.unit}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${scoreColorClass(p.scored.score)}`}>
                      <details className="relative print:hidden inline-block">
                        <summary className="list-none cursor-pointer">€ {p.price.toFixed(2)}</summary>
                        <div className="absolute right-0 top-full mt-1 z-10">
                          <BreakdownTooltip breakdown={p.scored.breakdown} />
                        </div>
                      </details>
                      <span className="hidden print:inline">€ {p.price.toFixed(2)}</span>
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${scoreColorClass(p.scored.score)}`}>€ {p.lineTotal.toFixed(2)}</td>
                    <td className="px-2 py-1.5 print:hidden">
                      {p.alternatives.length > 0 ? (
                        <select
                          value=""
                          onChange={(e) => {
                            const altId = e.target.value;
                            if (!altId) return;
                            setOverrides((prev) => ({ ...prev, [p.lineKey]: altId }));
                          }}
                          className="rounded border border-border-subtle bg-surface-base px-2 py-1 text-xs text-text-primary"
                        >
                          <option value="">Cambia fornitore…</option>
                          {p.alternatives.map((a) => (
                            <option key={a.itemId} value={a.itemId}>
                              {a.supplierName} — € {a.price.toFixed(2)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-text-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>

      <footer className="rounded-xl bg-surface-card border border-accent-green/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-text-primary font-medium">Totale carrello ottimale</span>
          <span className="text-2xl font-bold text-accent-green tabular-nums">€ {grandTotal.toFixed(2)}</span>
        </div>
        <button
          onClick={addAllToCart}
          disabled={addingToCart || buckets.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-accent-green text-surface-base font-semibold disabled:opacity-50 print:hidden"
        >
          <Plus className="h-5 w-5" />
          {addingToCart ? "Aggiungo..." : "Aggiungi al carrello e procedi all'ordine"}
        </button>
      </footer>
    </div>
  );

  function addAllToCart() {
    if (buckets.length === 0) return;
    setAddingToCart(true);
    try {
      let count = 0;
      for (const b of buckets) {
        const isReal = connectedSet.has(b.supplier.id);
        for (const p of b.picks) {
          addItem({
            productId:    isReal ? p.itemId : `catalog_${p.itemId}`,
            supplierId:   b.supplier.id,
            supplierName: b.supplier.supplier_name,
            name:         `${p.productName} (${p.unit})`,
            brand:        null,
            unit:         (p.unit || "pz") as UnitType,
            unitPrice:    p.price,
            quantity:     p.qty,
            imageUrl:     null,
            minQuantity:  1,
          });
          count += 1;
        }
      }
      toast.success(`${count} prodotti aggiunti al carrello`);
      router.push("/carrello");
    } finally {
      setAddingToCart(false);
    }
  }
}

function SummaryStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${
      highlight ? "border-accent-green/30 bg-accent-green/5" : "border-border-subtle bg-surface-card"
    }`}>
      <p className="text-xs uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${highlight ? "text-accent-green" : "text-text-primary"}`}>
        {value}
      </p>
    </div>
  );
}

function quote(s: string): string {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
