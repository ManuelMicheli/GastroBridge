"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { StockOverviewRow } from "@/lib/supplier/stock/queries";

type SortKey =
  | "product_name"
  | "warehouse_name"
  | "quantity_base"
  | "quantity_reserved_base"
  | "available_base"
  | "low_stock_threshold";

type SortDir = "asc" | "desc";

type Props = {
  items: StockOverviewRow[];
  /** Se true, nasconde la colonna Warehouse (usata quando lo switcher è già attivo). */
  hideWarehouseColumn?: boolean;
  /** Se true, il toggle "solo sotto scorta" è preattivato. Controlled dal parent. */
  onlyLowStock?: boolean;
  onToggleLowStock?: (value: boolean) => void;
};

const fmt = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 2,
});

export function StockOverviewTable({
  items,
  hideWarehouseColumn,
  onlyLowStock,
  onToggleLowStock,
}: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("product_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items;
    if (onlyLowStock) rows = rows.filter((r) => r.is_low);
    if (q.length > 0) {
      rows = rows.filter((r) =>
        `${r.product_name} ${r.warehouse_name}`.toLowerCase().includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [items, onlyLowStock, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const headerBtn = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-xs hover:text-text-primary ${
        align === "right" ? "justify-end w-full" : ""
      }`}
    >
      {label}
      {sortKey === key &&
        (sortDir === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        ))}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <label className="relative flex items-center w-full md:max-w-xs">
          <Search className="absolute left-3 h-4 w-4 text-text-secondary" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca prodotto o sede…"
            className="w-full rounded-md border border-border-subtle bg-surface-card pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent-green focus:outline-none focus:ring-1 focus:ring-accent-green"
            aria-label="Cerca nella tabella giacenze"
          />
        </label>
        {onToggleLowStock && (
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={!!onlyLowStock}
              onChange={(e) => onToggleLowStock(e.target.checked)}
              className="h-4 w-4 rounded border-border-subtle bg-surface-card accent-accent-amber"
            />
            Solo sotto scorta
          </label>
        )}
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-base text-left text-text-secondary">
                <th className="px-4 py-3">{headerBtn("product_name", "Prodotto")}</th>
                {!hideWarehouseColumn && (
                  <th className="px-4 py-3">{headerBtn("warehouse_name", "Sede")}</th>
                )}
                <th className="px-4 py-3 text-right">
                  {headerBtn("quantity_base", "Giacenza base", "right")}
                </th>
                <th className="px-4 py-3 text-right">
                  {headerBtn("quantity_reserved_base", "Riservato", "right")}
                </th>
                <th className="px-4 py-3 text-right">
                  {headerBtn("available_base", "Disponibile", "right")}
                </th>
                <th className="px-4 py-3 text-right">
                  {headerBtn("low_stock_threshold", "Soglia", "right")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                  Stato
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={hideWarehouseColumn ? 6 : 7}
                    className="px-4 py-12 text-center text-sm text-text-secondary"
                  >
                    Nessun prodotto corrisponde ai filtri.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const rowCls = r.is_low
                    ? "border-t border-border-subtle bg-accent-red/10 hover:bg-accent-red/15"
                    : "border-t border-border-subtle hover:bg-surface-hover";
                  return (
                    <tr key={`${r.product_id}|${r.warehouse_id}`} className={rowCls}>
                      <td className="px-4 py-3 text-sm font-medium text-text-primary">
                        {r.product_name || "—"}
                      </td>
                      {!hideWarehouseColumn && (
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {r.warehouse_name || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                        {fmt.format(r.quantity_base)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-secondary">
                        {fmt.format(r.quantity_reserved_base)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-primary">
                        {fmt.format(r.available_base)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-text-secondary">
                        {r.low_stock_threshold === null
                          ? "—"
                          : fmt.format(r.low_stock_threshold)}
                      </td>
                      <td className="px-4 py-3">
                        {r.is_low ? (
                          <span className="inline-flex items-center rounded-full bg-accent-red/20 text-accent-red px-2 py-0.5 text-xs font-medium">
                            Sotto scorta
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-accent-green/15 text-accent-green px-2 py-0.5 text-xs font-medium">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
