"use client";

import { type ReactNode } from "react";
import { ChevronDown, ChevronUp, LayoutList, Rows } from "lucide-react";
import { useDensity, type Density } from "@/lib/hooks/useDensity";
import { cn } from "@/lib/utils/formatters";

export type ColumnDef<T> = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

type Props<T> = {
  id: string;
  columns: ColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  emptyState?: ReactNode;
  pagination?: ReactNode;
  defaultDensity?: Density;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectedKeysChange?: (keys: Set<string>) => void;
  className?: string;
};

const rowHeight: Record<Density, string> = {
  compact: "h-9",
  cozy: "h-11",
  editorial: "h-14",
};

const cellPad: Record<Density, string> = {
  compact: "px-2.5 py-1.5",
  cozy: "px-3.5 py-2.5",
  editorial: "px-4 py-3.5",
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  id,
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
  emptyState,
  pagination,
  defaultDensity = "cozy",
  selectable = false,
  selectedKeys,
  onSelectedKeysChange,
  className,
}: Props<T>) {
  const { density, setDensity } = useDensity(id, defaultDensity);

  const onHeaderClick = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.key !== col.key) {
      onSortChange({ key: col.key, dir: "asc" });
    } else if (sort.dir === "asc") {
      onSortChange({ key: col.key, dir: "desc" });
    } else {
      onSortChange(null);
    }
  };

  return (
    <div className={cn("rounded-xl border border-border-default bg-surface-card overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle">
        <div className="text-xs text-text-secondary font-mono">{rows.length} risultati</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDensity("compact")}
            aria-pressed={density === "compact"}
            aria-label="Densità compatta"
            className={cn(
              "p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover",
              density === "compact" && "text-brand-primary bg-brand-primary-subtle",
            )}
          >
            <Rows className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDensity("cozy")}
            aria-pressed={density === "cozy"}
            aria-label="Densità comoda"
            className={cn(
              "p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover",
              density === "cozy" && "text-brand-primary bg-brand-primary-subtle",
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-surface-page border-b border-border-subtle">
            <tr>
              {selectable ? <th className="w-8 px-2" aria-label="Select" /> : null}
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.15em] text-text-secondary font-semibold whitespace-nowrap",
                      cellPad[density],
                      alignClass[col.align ?? "left"],
                      col.sortable && "cursor-pointer select-none hover:text-text-primary",
                    )}
                    onClick={() => onHeaderClick(col)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSorted ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="py-12">
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = getRowKey(row);
                const selected = selectable && selectedKeys?.has(key);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b border-border-subtle last:border-0 transition-colors",
                      rowHeight[density],
                      "hover:bg-surface-hover",
                      selected && "bg-brand-primary-subtle",
                    )}
                  >
                    {selectable ? (
                      <td className="px-2">
                        <input
                          type="checkbox"
                          checked={selected ?? false}
                          onChange={(e) => {
                            if (!selectedKeys || !onSelectedKeysChange) return;
                            const next = new Set(selectedKeys);
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                            onSelectedKeysChange(next);
                          }}
                          className="h-3.5 w-3.5 accent-brand-primary"
                        />
                      </td>
                    ) : null}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "text-sm text-text-primary",
                          cellPad[density],
                          alignClass[col.align ?? "left"],
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <div className="border-t border-border-subtle px-3 py-2">{pagination}</div>
      ) : null}
    </div>
  );
}
