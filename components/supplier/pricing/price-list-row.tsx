"use client";

import { Check, AlertCircle, Loader2 } from "lucide-react";
import type { EditorRow } from "./types";

type Status = "idle" | "saving" | "saved" | "error";

type Props = {
  row: EditorRow;
  status: Status;
  onChange: (value: string) => void;
  onBlur: () => void;
};

export function PriceListRow({ row, status, onChange, onBlur }: Props) {
  return (
    <tr className="border-t border-border-subtle hover:bg-surface-hover">
      <td className="px-4 py-3">
        <p className="font-medium text-text-primary">{row.product_name}</p>
        {row.product_brand && (
          <p className="text-xs text-text-secondary">{row.product_brand}</p>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">
        {row.sales_unit_label}
        {row.sales_unit_is_base && (
          <span className="ml-1 text-[10px] uppercase text-accent-green">
            base
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <span className="text-text-secondary text-sm">€</span>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={row.price}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="w-28 rounded-lg bg-surface-base border border-border-subtle px-2 py-1.5 text-right font-mono text-sm text-text-primary focus:border-accent-green focus:outline-none"
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {status === "saving" && (
          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" /> Salvo
          </span>
        )}
        {status === "saved" && (
          <span className="inline-flex items-center gap-1 text-xs text-accent-green">
            <Check className="h-3 w-3" /> Salvato
          </span>
        )}
        {status === "error" && (
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3 w-3" /> Errore
          </span>
        )}
      </td>
    </tr>
  );
}
