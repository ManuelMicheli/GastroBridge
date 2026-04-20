"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
    return (
      <div className="mx-auto max-w-[760px] px-4 py-16 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-text-tertiary">
        Caricamento ordine…
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8">
        <Link href="/cerca" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Torna a Cerca
        </Link>
        <article className="mt-4 rounded-xl border border-border-subtle bg-surface-card px-6 py-12 text-center font-mono">
          <p className="text-[12px] uppercase tracking-[0.2em] text-text-primary font-semibold">
            CARRELLO OTTIMALE
          </p>
          <p aria-hidden="true" className="mt-1 text-[11px] tracking-[0.05em] text-text-tertiary select-none">
            ──────────────────
          </p>
          <ShoppingCart className="mx-auto mt-5 h-6 w-6 text-text-tertiary" />
          <p className="mt-3 text-[12px] text-text-secondary">
            Devi prima creare almeno un catalogo fornitore.
          </p>
          <Link
            href="/cataloghi"
            className="mt-5 inline-flex rounded-lg bg-accent-green px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-surface-base hover:brightness-110"
          >
            Vai ai cataloghi
          </Link>
        </article>
      </div>
    );
  }

  if (order.length === 0) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8">
        <Link href="/cerca" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Torna a Cerca
        </Link>
        <article className="mt-4 rounded-xl border border-border-subtle bg-surface-card px-6 py-12 text-center font-mono">
          <p className="text-[12px] uppercase tracking-[0.2em] text-text-primary font-semibold">
            CARRELLO OTTIMALE
          </p>
          <p aria-hidden="true" className="mt-1 text-[11px] tracking-[0.05em] text-text-tertiary select-none">
            ──────────────────
          </p>
          <ShoppingCart className="mx-auto mt-5 h-6 w-6 text-text-tertiary" />
          <p className="mt-3 text-[12px] text-text-secondary">
            Il tuo ordine tipico è vuoto.
          </p>
          <Link
            href="/cerca"
            className="mt-5 inline-flex rounded-lg bg-accent-green px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-surface-base hover:brightness-110"
          >
            Compila l&apos;ordine tipico
          </Link>
        </article>
      </div>
    );
  }

  const totalArticles = buckets.reduce((s, b) => s + b.picks.length, 0);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 print:py-0 print:max-w-none">
      <div className="print:hidden mb-5">
        <Link
          href="/cerca"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Torna a Cerca
        </Link>
      </div>

      <article className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden print:border-0 print:rounded-none">
        {/* Header */}
        <header className="px-6 pt-6 pb-5 text-center font-mono">
          <p className="text-[12px] uppercase tracking-[0.2em] text-text-primary font-semibold">
            CARRELLO OTTIMALE
          </p>
          <p
            aria-hidden="true"
            className="mt-1 text-[11px] tracking-[0.05em] text-text-tertiary select-none"
          >
            ──────────────────
          </p>
          <p className="mx-auto mt-2 max-w-[56ch] text-[11px] leading-relaxed text-text-tertiary">
            Selezione automatica del fornitore con punteggio più alto per ogni prodotto dell&apos;ordine tipico.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[11px] uppercase tracking-[0.1em] text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            >
              <Printer className="h-3.5 w-3.5" /> Stampa
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[11px] uppercase tracking-[0.1em] text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </header>

        <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />

        {/* Summary stats */}
        <section className="grid grid-cols-3 divide-x divide-dashed divide-border-subtle">
          <Stat label="Fornitori" value={buckets.length.toString()} />
          <Stat label="Articoli" value={totalArticles.toString()} />
          <Stat label="Totale" value={`€ ${grandTotal.toFixed(2)}`} highlight />
        </section>

        {savingsVsAverage > 0 && (
          <div className="border-t border-dashed border-border-subtle bg-accent-green/5 px-6 py-2 text-center font-mono text-[11px] tracking-[0.05em] text-accent-green">
            Risparmio vs media · <span className="font-semibold tabular-nums">€ {savingsVsAverage.toFixed(2)}</span>
          </div>
        )}

        {missing.length > 0 && (
          <section className="border-t border-dashed border-border-subtle px-6 py-4">
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-yellow-500">
              <AlertTriangle className="h-3.5 w-3.5" /> {missing.length} non trovati
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-text-tertiary">
              {missing.map((m, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-text-secondary">
                    {m.productName} <span className="text-text-tertiary">({m.unit})</span>
                  </span>
                  <span className="shrink-0 tabular-nums">× {m.qty}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />

        {/* Supplier buckets */}
        {buckets.map((b, bi) => (
          <Fragment key={b.supplier.id}>
            <section className="px-6 py-5 print:break-inside-avoid">
              <header className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[13px] font-semibold text-text-primary">
                    <Link href={`/cataloghi/${b.supplier.id}`} className="transition hover:text-accent-green">
                      {b.supplier.supplier_name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                    {b.picks.length} {b.picks.length === 1 ? "articolo" : "articoli"}
                  </p>
                </div>
                <span className="font-mono text-[13px] font-semibold tabular-nums text-accent-green">
                  € {b.subtotal.toFixed(2)}
                </span>
              </header>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full table-fixed font-mono text-[11px]">
                  <colgroup>
                    <col className="w-[46%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
                      <th className="py-2 pr-2 text-left font-medium">Prodotto</th>
                      <th className="py-2 px-1 text-right font-medium">Q.tà</th>
                      <th className="py-2 px-1 text-left font-medium">Unità</th>
                      <th className="py-2 px-1 text-right font-medium">Prezzo</th>
                      <th className="py-2 pl-1 text-right font-medium">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.picks.map((p, i) => (
                      <tr key={i} className="border-t border-dashed border-border-subtle align-top">
                        <td className="py-2 pr-2 text-text-primary">
                          <span className="block truncate" title={p.productName}>
                            {p.productName}
                          </span>
                          {p.fallback && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-yellow-500">
                              <AlertTriangle className="h-2.5 w-2.5" /> vincoli
                            </span>
                          )}
                          {p.alternatives.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const altId = e.target.value;
                                if (!altId) return;
                                setOverrides((prev) => ({ ...prev, [p.lineKey]: altId }));
                              }}
                              className="mt-1 block w-full max-w-[220px] truncate rounded border border-border-subtle bg-surface-base px-1.5 py-0.5 text-[10px] text-text-secondary print:hidden"
                            >
                              <option value="">Cambia fornitore…</option>
                              {p.alternatives.map((a) => (
                                <option key={a.itemId} value={a.itemId}>
                                  {a.supplierName} — € {a.price.toFixed(2)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="py-2 px-1 text-right tabular-nums text-text-primary">
                          {p.qty}
                        </td>
                        <td className="py-2 px-1 truncate text-text-secondary" title={p.unit}>
                          {p.unit}
                        </td>
                        <td className={`py-2 px-1 text-right tabular-nums ${scoreColorClass(p.scored.score)}`}>
                          <details className="relative inline-block print:hidden">
                            <summary className="cursor-pointer list-none">€ {p.price.toFixed(2)}</summary>
                            <div className="absolute right-0 top-full z-10 mt-1">
                              <BreakdownTooltip breakdown={p.scored.breakdown} />
                            </div>
                          </details>
                          <span className="hidden print:inline">€ {p.price.toFixed(2)}</span>
                        </td>
                        <td className={`py-2 pl-1 text-right font-semibold tabular-nums ${scoreColorClass(p.scored.score)}`}>
                          € {p.lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            {bi < buckets.length - 1 && (
              <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />
            )}
          </Fragment>
        ))}

        <div aria-hidden="true" className="border-t border-dashed border-border-subtle" />

        {/* Footer / totals + CTA */}
        <section className="px-6 py-5 font-mono text-[12px]">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-secondary">articoli</span>
              <span className="tabular-nums text-text-primary">{totalArticles}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-secondary">fornitori</span>
              <span className="tabular-nums text-text-primary">{buckets.length}</span>
            </div>
          </div>

          <p
            aria-hidden="true"
            className="mt-3 text-[11px] tracking-[0.05em] text-text-tertiary select-none"
          >
            ──────────────────
          </p>

          <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
            <span className="uppercase tracking-[0.15em] text-text-primary font-semibold">
              TOTALE
            </span>
            <span className="font-semibold tabular-nums text-accent-green">
              € {grandTotal.toFixed(2)}
            </span>
          </div>

          <button
            onClick={addAllToCart}
            disabled={addingToCart || buckets.length === 0}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-green px-4 py-3 font-mono text-[12px] uppercase tracking-[0.15em] text-surface-base transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 print:hidden"
          >
            <Plus className="h-4 w-4" />
            {addingToCart ? "Aggiungo…" : "Aggiungi al carrello"}
          </button>
        </section>
      </article>
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`px-3 py-4 text-center font-mono ${
        highlight ? "bg-accent-green/5" : ""
      }`}
    >
      <p className="text-[10px] uppercase tracking-[0.15em] text-text-tertiary">
        {label}
      </p>
      <p
        className={`mt-1 text-[14px] tabular-nums ${
          highlight ? "font-semibold text-accent-green" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function quote(s: string): string {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
