"use client";

import { useMemo, useState } from "react";
import { buildPivot, type SupplierCol } from "@/lib/catalogs/compare";
import type { CatalogItemRow } from "@/lib/catalogs/types";
import {
  rankOffers,
  defaultPrefs,
  type Offer,
  type Preferences,
  type ScoreBreakdown,
} from "@/lib/scoring";
import { ActiveFiltersBar } from "@/components/shared/scoring/active-filters-bar";
import { CompareHeader } from "./_components/compare-header";
import { CompareSupplierToggle } from "./_components/compare-supplier-toggle";
import { CompareFilterBar } from "./_components/compare-filter-bar";
import { ComparePivotTable } from "./_components/compare-pivot-table";
import { CompareMobileList } from "./_components/compare-mobile-list";

type Props = {
  suppliers: SupplierCol[];
  items: (CatalogItemRow & { catalog_id: string })[];
  /** Normalized names of products the restaurateur has actually ordered. */
  orderedNormalizedNames: string[];
  /** Restaurant preferences — used for composite weights + per-cell Score. */
  preferences: Preferences | null;
};

export function CompareClient({
  suppliers,
  items,
  orderedNormalizedNames,
  preferences,
}: Props) {
  const prefs = preferences ?? defaultPrefs;
  const [selected, setSelected] = useState<Set<string>>(
    new Set(suppliers.map((s) => s.id)),
  );
  const [query, setQuery] = useState("");
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [onlyOrdered, setOnlyOrdered] = useState(false);

  const orderedSet = useMemo(
    () => new Set(orderedNormalizedNames),
    [orderedNormalizedNames],
  );

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
  // scored offer, so the table can show a Score tooltip per cell.
  const scoresByRow = useMemo(() => {
    const supplierById = new Map<string, SupplierCol>();
    for (const s of filteredSuppliers) supplierById.set(s.id, s);

    const byRow = new Map<
      string,
      Map<string, { score: number; breakdown: ScoreBreakdown }>
    >();
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
      const cellMap = new Map<
        string,
        { score: number; breakdown: ScoreBreakdown }
      >();
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
        const offered = Object.values(r.prices).filter(
          (p) => p !== null,
        ).length;
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
  const savingPct =
    mostExpensiveTotal > 0 ? (saving / mostExpensiveTotal) * 100 : 0;

  const toggleSupplier = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const head = [
      "Prodotto",
      "Unità",
      ...filteredSuppliers.map((s) => s.supplier_name),
      "Miglior prezzo",
    ];
    const lines = [head.join(";")];
    for (const r of visibleRows) {
      const cells = [
        quote(r.productName),
        quote(r.unit),
        ...filteredSuppliers.map((s) =>
          r.prices[s.id] == null ? "" : r.prices[s.id]!.toFixed(2),
        ),
        supplierName(filteredSuppliers, r.bestPriceSupplierId),
      ];
      lines.push(cells.join(";"));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `confronto-cataloghi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5 p-6">
      <CompareHeader
        supplierCount={filteredSuppliers.length}
        productCount={visibleRows.length}
        saving={saving}
        savingPct={savingPct}
      />

      <ActiveFiltersBar prefs={prefs} />

      <CompareSupplierToggle
        suppliers={suppliers}
        selected={selected}
        onToggle={toggleSupplier}
      />

      <CompareFilterBar
        query={query}
        onQueryChange={setQuery}
        onlyMulti={onlyMulti}
        onOnlyMultiChange={setOnlyMulti}
        onlyOrdered={onlyOrdered}
        onOnlyOrderedChange={setOnlyOrdered}
        orderedCount={orderedSet.size}
        visibleCount={visibleRows.length}
        totalCount={pivot.rows.length}
        onExportCsv={exportCsv}
      />

      <ComparePivotTable
        filteredSuppliers={filteredSuppliers}
        visibleRows={visibleRows}
        totals={pivot.totals}
        basketOptimalPrice={pivot.basketOptimalPrice}
        saving={saving}
        savingPct={savingPct}
        scoresByRow={scoresByRow}
      />

      <CompareMobileList
        filteredSuppliers={filteredSuppliers}
        visibleRows={visibleRows}
      />
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
