"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer, ShoppingCart, AlertTriangle } from "lucide-react";
import { normalizeName, normalizeUnit } from "@/lib/catalogs/normalize";

export type SupplierLite = { id: string; supplier_name: string };
export type CatalogItemLite = {
  id: string;
  catalog_id: string;
  product_name: string;
  product_name_normalized: string;
  unit: string;
  price: number;
};

type OrderLine = { key: string; productName: string; unit: string; qty: number };

const STORAGE_KEY = "gb.typical-order";

type Pick = {
  productName: string;
  unit: string;
  qty: number;
  price: number;
  lineTotal: number;
};

type SupplierBucket = {
  supplier: SupplierLite;
  picks: Pick[];
  subtotal: number;
};

export function OptimalCartClient({
  suppliers,
  items,
}: {
  suppliers: SupplierLite[];
  items: CatalogItemLite[];
}) {
  const [order, setOrder] = useState<OrderLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  // Index: (normName::unit) -> list of offers per supplier (cheapest first)
  const offersByKey = useMemo(() => {
    const supplierById = new Map<string, SupplierLite>();
    for (const s of suppliers) supplierById.set(s.id, s);

    const map = new Map<string, { supplier: SupplierLite; price: number }[]>();
    for (const it of items) {
      const supplier = supplierById.get(it.catalog_id);
      if (!supplier) continue;
      const key = `${it.product_name_normalized}::${it.unit}`;
      const list = map.get(key) ?? [];
      list.push({ supplier, price: it.price });
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.price - b.price);
    return map;
  }, [items, suppliers]);

  // Build buckets per supplier from the user's typical order
  const { buckets, missing, grandTotal } = useMemo(() => {
    const buckets = new Map<string, SupplierBucket>();
    const missing: { productName: string; unit: string; qty: number }[] = [];

    for (const line of order) {
      const lookupKey = line.key.includes("::")
        ? line.key
        : `${normalizeName(line.productName)}::${normalizeUnit(line.unit)}`;
      const offers = offersByKey.get(lookupKey);
      if (!offers || offers.length === 0) {
        missing.push({ productName: line.productName, unit: line.unit, qty: line.qty });
        continue;
      }
      const cheapest = offers[0]!;
      const lineTotal = cheapest.price * line.qty;
      let bucket = buckets.get(cheapest.supplier.id);
      if (!bucket) {
        bucket = { supplier: cheapest.supplier, picks: [], subtotal: 0 };
        buckets.set(cheapest.supplier.id, bucket);
      }
      bucket.picks.push({
        productName: line.productName,
        unit: line.unit,
        qty: line.qty,
        price: cheapest.price,
        lineTotal,
      });
      bucket.subtotal += lineTotal;
    }

    const sorted = Array.from(buckets.values()).sort((a, b) => b.subtotal - a.subtotal);
    const grandTotal = sorted.reduce((s, b) => s + b.subtotal, 0);
    return { buckets: sorted, missing, grandTotal };
  }, [order, offersByKey]);

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
            Per ogni prodotto è stato scelto il fornitore più economico. Ordini separati per fornitore.
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
            <table className="min-w-full text-sm mt-2">
              <thead className="text-text-tertiary">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">Prodotto</th>
                  <th className="text-right px-2 py-1 font-medium">Q.tà</th>
                  <th className="text-left px-2 py-1 font-medium">Unità</th>
                  <th className="text-right px-2 py-1 font-medium">Prezzo</th>
                  <th className="text-right px-2 py-1 font-medium">Totale</th>
                </tr>
              </thead>
              <tbody>
                {b.picks.map((p, i) => (
                  <tr key={i} className="border-t border-border-subtle">
                    <td className="px-2 py-1.5 text-text-primary">{p.productName}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-text-primary">{p.qty}</td>
                    <td className="px-2 py-1.5 text-text-secondary">{p.unit}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-text-secondary">€ {p.price.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-text-primary font-medium">€ {p.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>

      <footer className="rounded-xl bg-surface-card border border-accent-green/30 p-4 flex items-center justify-between">
        <span className="text-text-primary font-medium">Totale carrello ottimale</span>
        <span className="text-2xl font-bold text-accent-green tabular-nums">€ {grandTotal.toFixed(2)}</span>
      </footer>
    </div>
  );
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
