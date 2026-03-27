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
        "flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors",
        isSelected
          ? "bg-surface-hover text-text-primary"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      )}
    >
      <SectionIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
      <span className="flex-1 truncate">{item.label}</span>
      {isSelected && (
        <ArrowRight className="h-3.5 w-3.5 text-text-tertiary" />
      )}
    </button>
  );
}
