"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "../command-palette/command-palette-provider";

export function SearchTrigger() {
  const { open } = useCommandPalette();

  return (
    <button
      onClick={open}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-hover text-text-tertiary hover:text-text-secondary transition-colors text-sm"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Cerca...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-base text-[10px] font-mono text-text-tertiary border border-border-subtle">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
