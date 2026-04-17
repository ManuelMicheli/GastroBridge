// app/(app)/cerca/_components/result-row.tsx
"use client";

import { ChevronRight } from "lucide-react";
import { scoreColorClass } from "@/components/shared/scoring/score-badge";
import { highlight } from "@/lib/search/highlight";
import { Sparkline } from "./sparkline";
import type { Group } from "../_lib/types";

export function ResultRow({
  group,
  query,
  selected,
  onSelect,
  index,
}: {
  group: Group;
  query: string;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const best = group.offers[0];
  const score = best?.scored.score ?? 0;
  const priceCls = scoreColorClass(score);

  return (
    <button
      type="button"
      onClick={onSelect}
      id={`result-row-${index}`}
      data-selected={selected ? "true" : undefined}
      className={`flex h-14 w-full items-center gap-3 border-l-2 px-4 text-left transition-colors duration-75 ${
        selected
          ? "border-accent-green bg-accent-green/[0.06]"
          : "border-transparent hover:bg-surface-hover"
      }`}
      aria-selected={selected}
      role="option"
    >
      <span
        className={`block h-6 w-0.5 shrink-0 rounded-sm ${priceCls.replace("text-", "bg-")}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">
        {highlight(group.productName, query)}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-text-tertiary">
        / {group.unit}
      </span>
      <span className={`shrink-0 font-mono text-[14px] font-medium tabular-nums ${priceCls}`}>
        {best ? `€ ${best.price.toFixed(2)}` : "—"}
      </span>
      <Sparkline offers={group.offers} />
      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-text-tertiary">
        {group.offers.length}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
    </button>
  );
}
