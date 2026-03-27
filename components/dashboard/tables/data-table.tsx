"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

export type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  getRowKey: (row: T) => string;
};

export function DataTable<T>({ columns, data, onRowClick, emptyMessage, getRowKey }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text-tertiary">
        {emptyMessage || "Nessun dato disponibile"}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left text-[10px] uppercase tracking-widest font-bold text-text-tertiary px-4 py-3",
                  col.sortable && "cursor-pointer select-none hover:text-text-secondary transition-colors"
                )}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-border-subtle/50 transition-colors",
                onRowClick && "cursor-pointer hover:bg-surface-hover"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-text-secondary">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
