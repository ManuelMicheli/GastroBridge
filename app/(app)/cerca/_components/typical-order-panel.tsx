// app/(app)/cerca/_components/typical-order-panel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBasket, Upload, Download } from "lucide-react";
import { TypicalOrderAdd } from "./typical-order-add";
import { TypicalOrderTable } from "./typical-order-table";
import { ImportWizard } from "./import-wizard";
import type { Group, OrderLine } from "../_lib/types";
import type { ProductIndex } from "../_lib/product-index";

const STORAGE_KEY = "gb.typical-order";

export function TypicalOrderPanel({
  groups,
  index,
  pendingAdd,
  onConsumedAdd,
}: {
  groups: Group[];
  index: ProductIndex;
  pendingAdd: OrderLine | null;           // when user adds from detail pane
  onConsumedAdd: () => void;
}) {
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderLine[];
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  useEffect(() => {
    if (!pendingAdd) return;
    addLine(pendingAdd);
    onConsumedAdd();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAdd]);

  const groupByKey = useMemo(() => {
    const m = new Map<string, Group>();
    for (const g of groups) m.set(g.key, g);
    return m;
  }, [groups]);

  const addLine = (line: OrderLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        return prev.map((l) => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l));
      }
      return [...prev, line];
    });
  };

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateQty = (key: string, raw: string) => {
    const q = Number(raw.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty: q } : l)));
  };

  const onImported = (incoming: OrderLine[], mode: "append" | "replace") => {
    setLines((prev) => {
      const base = mode === "replace" ? [] : prev;
      const merged = [...base];
      for (const line of incoming) {
        const existing = merged.find((l) => l.key === line.key);
        if (existing) existing.qty += line.qty;
        else merged.push(line);
      }
      return merged;
    });
  };

  const basketOptimal = useMemo(() => {
    let s = 0;
    for (const line of lines) {
      const g = groupByKey.get(line.key);
      if (!g || g.offers.length === 0) continue;
      s += g.offers[0]!.price * line.qty;
    }
    return s;
  }, [lines, groupByKey]);

  const perSupplier = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) for (const o of g.offers) ids.add(o.supplier.id);
    return Array.from(ids)
      .map((sid) => {
        const g0 = groups.find((g) => g.offers.some((o) => o.supplier.id === sid));
        const name = g0?.offers.find((o) => o.supplier.id === sid)?.supplier.supplier_name ?? "";
        let total = 0;
        let coveredItems = 0;
        for (const line of lines) {
          const g = groupByKey.get(line.key);
          const offer = g?.offers.find((o) => o.supplier.id === sid);
          if (offer) {
            total += offer.price * line.qty;
            coveredItems += 1;
          }
        }
        return { id: sid, name, total, coveredItems };
      })
      .filter((s) => s.coveredItems > 0)
      .sort((a, b) =>
        a.coveredItems !== b.coveredItems ? b.coveredItems - a.coveredItems : a.total - b.total,
      );
  }, [groups, lines, groupByKey]);

  const exportCsv = () => {
    if (lines.length === 0) return;
    const header = "nome;unita;quantita";
    const rows = lines.map((l) => `${l.productName};${l.unit};${l.qty}`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ordine-tipico.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 lg:space-y-5 lg:px-4 lg:py-6">
      <header className="space-y-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:space-y-0">
        <div className="rounded-xl border border-border-subtle bg-surface-card px-4 py-3 lg:border-0 lg:bg-transparent lg:p-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            Ordine tipico · {lines.length} righe
          </p>
          <p className="font-mono text-[20px] tabular-nums text-text-primary lg:text-[18px]">
            basket ottimale <span className="text-accent-green">€ {basketOptimal.toFixed(2)}</span>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[13px] hover:bg-surface-hover"
          >
            <Upload className="h-3.5 w-3.5" /> importa
          </button>
          <button
            onClick={exportCsv}
            disabled={lines.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[13px] hover:bg-surface-hover disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> export
          </button>
          {lines.length > 0 && (
            <button
              onClick={() => setLines([])}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle px-3 py-2 text-[13px] text-red-400 hover:bg-red-500/10"
            >
              svuota
            </button>
          )}
        </div>
      </header>

      <TypicalOrderAdd groups={groups} index={index} onAdd={addLine} />

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groups={groups}
        onImported={onImported}
      />

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-subtle py-10 text-center text-[13px] text-text-tertiary">
          Nessun prodotto. Cerca qui sopra o importa un file.
        </p>
      ) : (
        <>
          <TypicalOrderTable
            lines={lines}
            groupByKey={groupByKey}
            onUpdateQty={updateQty}
            onRemove={removeLine}
          />

          {perSupplier.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                Se comprassi tutto da un solo fornitore
              </h3>
              <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
                {perSupplier.map((s) => {
                  const isFull = s.coveredItems === lines.length;
                  const delta = s.total - basketOptimal;
                  return (
                    <li key={s.id} className="flex items-center justify-between px-3 py-2 text-[13px]">
                      <span className="text-text-secondary">
                        <Link href={`/cataloghi/${s.id}`} className="text-text-primary hover:underline">
                          {s.name}
                        </Link>
                        {!isFull && (
                          <span className="ml-2 font-mono text-[11px] text-text-tertiary">
                            (copre {s.coveredItems}/{lines.length})
                          </span>
                        )}
                      </span>
                      <span className="font-mono tabular-nums text-text-primary">
                        € {s.total.toFixed(2)}
                        {isFull && delta > 0 && (
                          <span className="ml-2 text-[11px] text-text-tertiary">
                            (+€ {delta.toFixed(2)})
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="lg:flex lg:justify-end">
            <Link
              href="/cerca/ordine"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent-green px-4 py-3 text-[14px] font-medium text-surface-base lg:w-auto lg:py-2.5 lg:text-[13px]"
            >
              <ShoppingBasket className="h-4 w-4" /> Carrello ottimale
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
