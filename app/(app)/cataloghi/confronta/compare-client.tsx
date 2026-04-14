"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Star } from "lucide-react";
import { buildPivot, type SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";

type Props = {
  suppliers: SupplierCol[];
  items: (CatalogItemRow & { catalog_id: string })[];
};

export function CompareClient({ suppliers, items }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(suppliers.map((s) => s.id)));
  const [wPrezzo, setWPrezzo] = useState(0.7);
  const [query, setQuery] = useState("");
  const [onlyMulti, setOnlyMulti] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("gb.compare.weights");
    if (raw) {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 1) setWPrezzo(v);
    }
  }, []);
  useEffect(() => { localStorage.setItem("gb.compare.weights", String(wPrezzo)); }, [wPrezzo]);

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => selected.has(s.id)),
    [suppliers, selected],
  );
  const filteredItems = useMemo(
    () => items.filter((i) => selected.has(i.catalog_id)),
    [items, selected],
  );

  const pivot = useMemo(
    () => buildPivot(filteredSuppliers, filteredItems, { w_prezzo: wPrezzo, w_consegna: 1 - wPrezzo }),
    [filteredSuppliers, filteredItems, wPrezzo],
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pivot.rows.filter((r) => {
      if (q && !r.productName.toLowerCase().includes(q)) return false;
      if (onlyMulti) {
        const offered = Object.values(r.prices).filter((p) => p !== null).length;
        if (offered < 2) return false;
      }
      return true;
    });
  }, [pivot.rows, query, onlyMulti]);

  const mostExpensiveTotal = Math.max(0, ...Object.values(pivot.totals));
  const saving = mostExpensiveTotal - pivot.basketOptimalPrice;
  const savingPct = mostExpensiveTotal > 0 ? (saving / mostExpensiveTotal) * 100 : 0;

  const exportCsv = () => {
    const head = ["Prodotto", "Unità", ...filteredSuppliers.map((s) => s.supplier_name), "Miglior prezzo", "Miglior composito"];
    const lines = [head.join(";")];
    for (const r of visibleRows) {
      const cells = [
        quote(r.productName),
        quote(r.unit),
        ...filteredSuppliers.map((s) => r.prices[s.id] == null ? "" : r.prices[s.id]!.toFixed(2)),
        supplierName(filteredSuppliers, r.bestPriceSupplierId),
        supplierName(filteredSuppliers, r.bestCompositeSupplierId),
      ];
      lines.push(cells.join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `confronto-cataloghi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/cataloghi" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Cataloghi
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">Confronto prezzi</h1>
        <p className="text-sm text-text-secondary">
          Il miglior prezzo per riga è evidenziato in verde. Il miglior complessivo (prezzo + consegna) con una stella.
        </p>
      </header>

      {/* Supplier toggle */}
      <div className="flex flex-wrap gap-2">
        {suppliers.map((s) => (
          <label key={s.id} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
            selected.has(s.id) ? "border-accent-green/50 bg-accent-green/10 text-accent-green" : "border-border-subtle text-text-secondary"
          }`}>
            <input type="checkbox" className="sr-only" checked={selected.has(s.id)}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                  return next;
                })} />
            {s.supplier_name}
          </label>
        ))}
      </div>

      {/* Weights */}
      <div className="rounded-xl bg-surface-card border border-border-subtle p-4 space-y-2 max-w-xl">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>Peso prezzo: {(wPrezzo * 100).toFixed(0)}%</span>
          <span>Peso consegna: {((1 - wPrezzo) * 100).toFixed(0)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.05} value={wPrezzo}
          onChange={(e) => setWPrezzo(Number(e.target.value))}
          className="w-full" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" placeholder="Cerca prodotto..." value={query} onChange={(e) => setQuery(e.target.value)}
          className="rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary w-64" />
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={onlyMulti} onChange={(e) => setOnlyMulti(e.target.checked)} />
          Solo prodotti offerti da ≥ 2 fornitori
        </label>
        <button onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
          <Download className="h-4 w-4" /> Esporta CSV
        </button>
      </div>

      {/* Pivot table */}
      <div className="hidden md:block rounded-xl border border-border-subtle overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-text-tertiary">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Prodotto</th>
              <th className="text-left px-3 py-2 font-medium">Unità</th>
              {filteredSuppliers.map((s) => (
                <th key={s.id} className="text-right px-3 py-2 font-medium">
                  <div className="text-text-primary">{s.supplier_name}</div>
                  <div className="text-[10px] text-text-tertiary">
                    {s.delivery_days !== null ? `🚚 ${s.delivery_days} gg` : "— gg"}
                    {s.min_order_amount !== null ? ` · min € ${s.min_order_amount.toFixed(2)}` : ""}
                  </div>
                </th>
              ))}
              <th className="text-left px-3 py-2 font-medium">Miglior prezzo</th>
              <th className="text-left px-3 py-2 font-medium">Miglior composito</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={filteredSuppliers.length + 4} className="px-3 py-6 text-center text-text-tertiary">Nessun prodotto da confrontare</td></tr>
            ) : visibleRows.map((r) => (
              <tr key={r.key} className="border-t border-border-subtle">
                <td className="px-3 py-2 text-text-primary">{r.productName}</td>
                <td className="px-3 py-2 text-text-secondary">{r.unit}</td>
                {filteredSuppliers.map((s) => {
                  const p = r.prices[s.id];
                  const isBestPrice = r.bestPriceSupplierId === s.id;
                  const isBestComposite = r.bestCompositeSupplierId === s.id;
                  return (
                    <td key={s.id} className={`px-3 py-2 text-right tabular-nums ${
                      isBestPrice ? "bg-accent-green/10 text-accent-green font-medium" : "text-text-primary"
                    }`}>
                      {p == null ? "—" : <>€ {p.toFixed(2)} {isBestComposite && <Star className="inline h-3 w-3 ml-0.5" />}</>}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-accent-green">{supplierName(filteredSuppliers, r.bestPriceSupplierId)}</td>
                <td className="px-3 py-2 text-text-primary">{supplierName(filteredSuppliers, r.bestCompositeSupplierId)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-card">
            <tr className="border-t border-border-subtle">
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Totale per fornitore</td>
              {filteredSuppliers.map((s) => {
                const total = pivot.totals[s.id] ?? 0;
                const belowMin = s.min_order_amount !== null && total > 0 && total < s.min_order_amount;
                return (
                  <td key={s.id} className="px-3 py-2 text-right tabular-nums">
                    <div className="text-text-primary">€ {total.toFixed(2)}</div>
                    {belowMin && (
                      <div className="text-[10px] text-red-400">Sotto soglia (−€ {(s.min_order_amount! - total).toFixed(2)})</div>
                    )}
                  </td>
                );
              })}
              <td colSpan={2} />
            </tr>
            <tr className="border-t border-border-subtle">
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Basket ottimale (prezzo)</td>
              <td colSpan={filteredSuppliers.length} className="px-3 py-2 text-right tabular-nums text-accent-green font-medium">
                € {pivot.basketOptimalPrice.toFixed(2)}
              </td>
              <td colSpan={2} />
            </tr>
            <tr>
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Basket ottimale (composito)</td>
              <td colSpan={filteredSuppliers.length} className="px-3 py-2 text-right tabular-nums text-text-primary">
                € {pivot.basketOptimalComposite.toFixed(2)}
              </td>
              <td colSpan={2} />
            </tr>
            {saving > 0 && (
              <tr>
                <td colSpan={2 + filteredSuppliers.length + 2} className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-green/10 text-accent-green text-sm">
                    Risparmio potenziale: € {saving.toFixed(2)} ({savingPct.toFixed(0)}%)
                  </span>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {visibleRows.length === 0 ? (
          <p className="text-center text-text-tertiary py-6">Nessun prodotto</p>
        ) : visibleRows.map((r) => {
          const offers = filteredSuppliers
            .map((s) => ({ s, price: r.prices[s.id] }))
            .filter((x): x is { s: SupplierCol; price: number } => x.price !== null && x.price !== undefined)
            .sort((a, b) => a.price - b.price);
          return (
            <div key={r.key} className="rounded-xl bg-surface-card border border-border-subtle p-3">
              <div className="flex justify-between items-baseline">
                <h3 className="text-text-primary font-medium">{r.productName}</h3>
                <span className="text-xs text-text-tertiary">{r.unit}</span>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {offers.map(({ s, price }) => {
                  const isBestPrice = r.bestPriceSupplierId === s.id;
                  const isBestComposite = r.bestCompositeSupplierId === s.id;
                  return (
                    <li key={s.id} className="flex justify-between">
                      <span className={isBestPrice ? "text-accent-green" : "text-text-secondary"}>
                        {s.supplier_name} {isBestComposite && <Star className="inline h-3 w-3 ml-0.5" />}
                      </span>
                      <span className={`tabular-nums ${isBestPrice ? "text-accent-green font-medium" : "text-text-primary"}`}>
                        € {price.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function supplierName(suppliers: SupplierCol[], id: string | null): string {
  if (!id) return "—";
  return suppliers.find((s) => s.id === id)?.supplier_name ?? "—";
}

function quote(s: string): string {
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
