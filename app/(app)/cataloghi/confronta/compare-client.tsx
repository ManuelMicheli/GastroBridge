"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { buildPivot, type SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";
import {
  rankOffers,
  defaultPrefs,
  type Offer,
  type Preferences,
} from "@/lib/scoring";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import { BreakdownTooltip } from "@/components/shared/scoring/breakdown-tooltip";
import { ActiveFiltersBar } from "@/components/shared/scoring/active-filters-bar";

type Props = {
  suppliers: SupplierCol[];
  items: (CatalogItemRow & { catalog_id: string })[];
  /** Normalized names of products the restaurateur has actually ordered. */
  orderedNormalizedNames: string[];
  /** Restaurant preferences — used for composite weights + per-cell Score. */
  preferences: Preferences | null;
};

export function CompareClient({ suppliers, items, orderedNormalizedNames, preferences }: Props) {
  const prefs = preferences ?? defaultPrefs;
  const [selected, setSelected] = useState<Set<string>>(new Set(suppliers.map((s) => s.id)));
  const [query, setQuery] = useState("");
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlyOrdered, setOnlyOrdered] = useState(false);

  const orderedSet = useMemo(() => new Set(orderedNormalizedNames), [orderedNormalizedNames]);

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => selected.has(s.id)),
    [suppliers, selected],
  );
  const filteredItems = useMemo(
    () => items.filter((i) => selected.has(i.catalog_id)),
    [items, selected],
  );

  // Map the scoring-engine weights into the compare's price/delivery cost
  // function. Price and delivery are the two axes this compare view
  // surfaces; quality doesn't have per-catalog-item data, so we fold it
  // into price weight proportionally (the "you care about price and
  // intrinsic goodness" axis).
  const compareWeights = useMemo(() => {
    const g = prefs.global;
    const wp = g.priceWeight + g.qualityWeight;
    const wd = g.deliveryWeight;
    const total = wp + wd;
    if (total <= 0) return { w_prezzo: 1, w_consegna: 0 };
    return { w_prezzo: wp / total, w_consegna: wd / total };
  }, [prefs]);

  const pivot = useMemo(
    () => buildPivot(filteredSuppliers, filteredItems, compareWeights),
    [filteredSuppliers, filteredItems, compareWeights],
  );

  // Per-row scored offers keyed by row.key. Each entry is supplierId ->
  // scored offer, so the table can show a ScoreBadge per cell.
  const scoresByRow = useMemo(() => {
    const supplierById = new Map<string, SupplierCol>();
    for (const s of filteredSuppliers) supplierById.set(s.id, s);

    const byRow = new Map<string, Map<string, { score: number; breakdown: import("@/lib/scoring").ScoreBreakdown }>>();
    for (const row of pivot.rows) {
      const offers: Offer[] = [];
      const offerIdToSupplier = new Map<string, string>();
      for (const s of filteredSuppliers) {
        const price = row.prices[s.id];
        if (price == null) continue;
        const offerId = `${row.key}__${s.id}`;
        offers.push({
          id: offerId,
          supplierId: s.id,
          productName: row.productName,
          unit: row.unit,
          price,
          qualityTier: "standard",
          isBio: false,
          leadTimeDays: s.delivery_days ?? 2,
          certifications: [],
          macroCategory: "altro",
          supplierMinOrder: s.min_order_amount ?? undefined,
        });
        offerIdToSupplier.set(offerId, s.id);
      }
      if (offers.length === 0) continue;
      const result = rankOffers(offers, prefs);
      const cellMap = new Map<string, { score: number; breakdown: import("@/lib/scoring").ScoreBreakdown }>();
      for (const s of result.included) {
        const sid = offerIdToSupplier.get(s.offer.id);
        if (!sid) continue;
        cellMap.set(sid, { score: s.score, breakdown: s.breakdown });
      }
      byRow.set(row.key, cellMap);
    }
    return byRow;
  }, [pivot.rows, filteredSuppliers, prefs]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pivot.rows.filter((r) => {
      if (q && !r.productName.toLowerCase().includes(q)) return false;
      if (onlyMulti) {
        const offered = Object.values(r.prices).filter((p) => p !== null).length;
        if (offered < 2) return false;
      }
      if (onlyOrdered) {
        const normalized = r.key.split("::")[0] ?? "";
        if (!orderedSet.has(normalized)) return false;
      }
      return true;
    });
  }, [pivot.rows, query, onlyMulti, onlyOrdered, orderedSet]);

  const mostExpensiveTotal = Math.max(0, ...Object.values(pivot.totals));
  const saving = mostExpensiveTotal - pivot.basketOptimalPrice;
  const savingPct = mostExpensiveTotal > 0 ? (saving / mostExpensiveTotal) * 100 : 0;

  const exportCsv = () => {
    const head = ["Prodotto", "Unità", ...filteredSuppliers.map((s) => s.supplier_name), "Miglior prezzo"];
    const lines = [head.join(";")];
    for (const r of visibleRows) {
      const cells = [
        quote(r.productName),
        quote(r.unit),
        ...filteredSuppliers.map((s) => r.prices[s.id] == null ? "" : r.prices[s.id]!.toFixed(2)),
        supplierName(filteredSuppliers, r.bestPriceSupplierId),
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
          Per ogni prodotto, il prezzo più basso è evidenziato in verde. Lo score tiene conto delle tue preferenze.
        </p>
      </header>

      <ActiveFiltersBar prefs={prefs} />

      {/* Supplier toggle */}
      <div className="flex flex-wrap gap-2">
        {suppliers.map((s) => (
          <label key={s.id} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer ${
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" placeholder="Cerca prodotto..." value={query} onChange={(e) => setQuery(e.target.value)}
          className="rounded-lg bg-surface-base border border-border-subtle px-3 py-2 text-text-primary w-64" />
        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={onlyMulti} onChange={(e) => setOnlyMulti(e.target.checked)} />
          Solo prodotti offerti da ≥ 2 fornitori
        </label>
        <label
          className={`inline-flex items-center gap-2 text-sm ${
            orderedSet.size === 0 ? "text-text-tertiary cursor-not-allowed" : "text-text-secondary"
          }`}
          title={orderedSet.size === 0 ? "Nessun ordine recente da cui dedurre i prodotti" : undefined}
        >
          <input
            type="checkbox"
            checked={onlyOrdered}
            disabled={orderedSet.size === 0}
            onChange={(e) => setOnlyOrdered(e.target.checked)}
          />
          Solo i miei più ordinati
          {orderedSet.size > 0 && (
            <span className="text-xs text-text-tertiary">({orderedSet.size})</span>
          )}
        </label>
        <button onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border-subtle text-text-primary hover:bg-surface-hover">
          <Download className="h-4 w-4" /> Esporta CSV
        </button>
      </div>

      {/* Pivot table — desktop */}
      <div className="hidden md:block rounded-xl border border-border-subtle overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-text-tertiary">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Prodotto</th>
              <th className="text-left px-3 py-2 font-medium">Unità</th>
              {filteredSuppliers.map((s) => (
                <th key={s.id} className="text-right px-3 py-2 font-medium text-text-primary">
                  {s.supplier_name}
                </th>
              ))}
              <th className="text-left px-3 py-2 font-medium">Miglior prezzo</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={filteredSuppliers.length + 3} className="px-3 py-6 text-center text-text-tertiary">Nessun prodotto da confrontare</td></tr>
            ) : visibleRows.map((r) => {
              const rowScores = scoresByRow.get(r.key);
              return (
              <tr key={r.key} className="border-t border-border-subtle">
                <td className="px-3 py-2 text-text-primary">{r.productName}</td>
                <td className="px-3 py-2 text-text-secondary">{r.unit}</td>
                {filteredSuppliers.map((s) => {
                  const p = r.prices[s.id];
                  const isBestPrice = r.bestPriceSupplierId === s.id;
                  const cell = rowScores?.get(s.id);
                  const priceColor = cell ? scoreColorClass(cell.score) : "text-text-primary";
                  return (
                    <td key={s.id} className={`px-3 py-2 text-right tabular-nums font-medium ${
                      isBestPrice ? "bg-accent-green/10" : ""
                    } ${priceColor}`}>
                      {p == null ? (
                        <span className="text-text-tertiary font-normal">—</span>
                      ) : cell ? (
                        <details className="relative">
                          <summary className="list-none cursor-pointer">€ {p.toFixed(2)}</summary>
                          <div className="absolute right-0 top-full mt-1 z-10 text-left">
                            <BreakdownTooltip breakdown={cell.breakdown} />
                          </div>
                        </details>
                      ) : (
                        <span>€ {p.toFixed(2)}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-accent-green">{supplierName(filteredSuppliers, r.bestPriceSupplierId)}</td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-surface-card">
            <tr className="border-t border-border-subtle">
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Totale per fornitore</td>
              {filteredSuppliers.map((s) => {
                const total = pivot.totals[s.id] ?? 0;
                return (
                  <td key={s.id} className="px-3 py-2 text-right tabular-nums text-text-primary">
                    € {total.toFixed(2)}
                  </td>
                );
              })}
              <td />
            </tr>
            <tr className="border-t border-border-subtle">
              <td colSpan={2} className="px-3 py-2 font-medium text-text-primary">Basket ottimale</td>
              <td colSpan={filteredSuppliers.length} className="px-3 py-2 text-right tabular-nums text-accent-green font-medium">
                € {pivot.basketOptimalPrice.toFixed(2)}
              </td>
              <td />
            </tr>
            {saving > 0 && (
              <tr>
                <td colSpan={3 + filteredSuppliers.length} className="px-3 py-2">
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
          const rowScores = scoresByRow.get(r.key);
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
                  const cell = rowScores?.get(s.id);
                  const priceColor = cell ? scoreColorClass(cell.score) : "text-text-primary";
                  return (
                    <li key={s.id} className="flex justify-between">
                      <span className={isBestPrice ? "text-accent-green" : "text-text-secondary"}>
                        {s.supplier_name}
                      </span>
                      <span className={`tabular-nums font-medium ${priceColor}`}>
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
