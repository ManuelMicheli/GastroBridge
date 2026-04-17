// app/(app)/cerca/_components/typical-order-add.tsx
"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, Search } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import { searchGroups, type ProductIndex } from "../_lib/product-index";
import type { Group, OrderLine } from "../_lib/types";

const MAX_SUGGESTIONS = 8;

export function TypicalOrderAdd({
  groups,
  index,
  onAdd,
}: {
  groups: Group[];
  index: ProductIndex;
  onAdd: (line: OrderLine) => void;
}) {
  const [q, setQ] = useState("");
  const [qty, setQty] = useState("1");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions: Group[] = useMemo(() => {
    if (!q.trim()) return [];
    const ids = searchGroups(index, groups, q).slice(0, MAX_SUGGESTIONS);
    const byKey = new Map(groups.map((g) => [g.key, g]));
    return ids.map((id) => byKey.get(id)!).filter(Boolean);
  }, [q, index, groups]);

  useEffect(() => setHighlighted(0), [q]);

  const commit = (g: Group | undefined) => {
    const chosen = g ?? suggestions[highlighted];
    if (!chosen) return;
    const nQty = Number(qty.replace(",", "."));
    if (!Number.isFinite(nQty) || nQty <= 0) return;
    onAdd({ key: chosen.key, productName: chosen.productName, unit: chosen.unit, qty: nQty });
    setQ("");
    setQty("1");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 focus-within:ring-2 focus-within:ring-accent-green/40">
        <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(suggestions.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(undefined);
            }
          }}
          placeholder="Cerca prodotto da aggiungere…"
          className="flex-1 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-tertiary"
          autoComplete="off"
        />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-tertiary">
          qty
        </span>
        <input
          type="number"
          min={0}
          step="0.1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(undefined);
            }
          }}
          className="w-16 rounded border border-border-subtle bg-surface-base px-2 py-1 text-right font-mono tabular-nums text-text-primary"
        />
        <button
          onClick={() => commit(undefined)}
          disabled={suggestions.length === 0}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent-green px-3 py-1.5 text-[13px] font-medium text-surface-base disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> add
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-lg">
          {suggestions.map((g, i) => {
            const best = g.offers[0];
            const cls = best ? scoreColorClass(best.scored.score) : "";
            return (
              <li key={g.key}>
                <button
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => commit(g)}
                  className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-[13px] ${
                    i === highlighted ? "bg-surface-hover" : ""
                  }`}
                >
                  <span className="flex-1 truncate text-text-primary">{g.productName}</span>
                  <span className="font-mono text-[11px] text-text-tertiary">/ {g.unit}</span>
                  {best && (
                    <span className={`font-mono tabular-nums ${cls}`}>
                      € {best.price.toFixed(2)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
