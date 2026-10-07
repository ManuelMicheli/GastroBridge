"use client";

import { cn } from "@/lib/utils/formatters";
import {
  FileText, Zap, ArrowRight,
} from "lucide-react";
import type { SearchItem } from "./use-fuzzy-search";

type Props = {
  item: SearchItem;
  isSelected: boolean;
  onSelect: () => void;
};

export function CommandItem({ item, isSelected, onSelect }: Props) {
  const SectionIcon = item.section === "Azioni" ? Zap : FileText;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={(e) => e.currentTarget.focus()}
      className={cn(
        "mx-2 flex w-[calc(100%-16px)] items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition-colors",
        isSelected
          ? "bg-[var(--acc-50)] text-[var(--f-ink)]"
          : "text-[var(--f-ink-2)] hover:bg-[var(--f-fill)] hover:text-[var(--f-ink)]"
      )}
    >
      <SectionIcon className={cn("h-4 w-4 shrink-0", isSelected ? "text-[var(--acc-600)]" : "text-[var(--f-faint)]")} />
      <span className="flex-1 truncate">{item.label}</span>
      {isSelected && (
        <ArrowRight className="h-3.5 w-3.5 text-[var(--acc-600)]" />
      )}
    </button>
  );
}
