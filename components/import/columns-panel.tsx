"use client";

import { useState } from "react";
import { Columns3, RotateCcw } from "lucide-react";
import type { ColumnRole, ExtractionResult } from "@/lib/import/types";

const ROLE_LABELS: Record<ColumnRole, string> = {
  name: "Nome prodotto",
  code: "Codice",
  unit: "Unità",
  pack: "Formato / confezione",
  price: "Prezzo",
  vat: "IVA",
  brand: "Marca",
  category: "Categoria",
  origin: "Origine",
  minQty: "Quantità minima",
  availability: "Disponibilità / note",
  qty: "Quantità",
  ignore: "Ignora",
};

/**
 * Only for tables: shows how each column was understood and lets the user fix
 * it. The fix re-runs the analysis and is remembered for this supplier.
 */
export function ColumnsPanel({
  result,
  onApply,
  busy,
}: {
  result: ExtractionResult;
  onApply: (overrides: Record<string, Record<number, ColumnRole>>) => void;
  busy?: boolean;
}) {
  const tables = result.stats.strategies.filter((s) => s.strategy === "table" && s.columns && s.columns.length > 0);
  const [draft, setDraft] = useState<Record<string, Record<number, ColumnRole>>>(() =>
    Object.fromEntries(
      tables.map((t) => [t.sheet, Object.fromEntries((t.columns ?? []).map((c) => [c.index, c.role ?? "ignore"]))]),
    ),
  );
  const [open, setOpen] = useState(false);
  if (tables.length === 0) return null;

  return (
    <details className="f-card p-0" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
        <span className="flex items-center gap-2 text-[14px] font-medium text-[var(--f-ink)]">
          <Columns3 className="h-4 w-4 text-[var(--acc-700)]" /> Colonne riconosciute
        </span>
        <span className="text-[12.5px] text-[var(--f-muted)]">Qualcosa non torna? Correggi qui</span>
      </summary>
      <div className="space-y-4 border-t border-[var(--f-line)] px-5 py-4">
        {tables.map((t) => (
          <div key={t.sheet}>
            {tables.length > 1 ? <p className="mb-2 text-[13px] font-medium text-[var(--f-ink-2)]">Foglio «{t.sheet}»</p> : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(t.columns ?? []).map((c) => (
                <label key={c.index} className="flex flex-col gap-1 rounded-xl bg-[var(--f-fill)] p-3">
                  <span className="truncate text-[12.5px] font-medium text-[var(--f-ink)]" title={c.header}>{c.header}</span>
                  <span className="truncate text-[11.5px] text-[var(--f-faint)]" title={c.sample}>es. {c.sample || "—"}</span>
                  <select
                    className="f-input mt-1 h-9 text-[13px]"
                    value={draft[t.sheet]?.[c.index] ?? "ignore"}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [t.sheet]: { ...(d[t.sheet] ?? {}), [c.index]: e.target.value as ColumnRole } }))
                    }
                  >
                    {(Object.keys(ROLE_LABELS) as ColumnRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            className="f-btn f-btn-primary f-btn-sm"
            disabled={busy}
            onClick={() => {
              const clean: Record<string, Record<number, ColumnRole>> = {};
              for (const [sheet, roles] of Object.entries(draft)) {
                clean[sheet] = Object.fromEntries(Object.entries(roles).filter(([, r]) => r !== "ignore")) as Record<number, ColumnRole>;
              }
              onApply(clean);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Rianalizza con queste colonne
          </button>
        </div>
      </div>
    </details>
  );
}
