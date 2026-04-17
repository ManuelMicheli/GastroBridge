"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCommandPalette } from "../command-palette/command-palette-provider";

export function SearchTrigger() {
  const { open } = useCommandPalette();
  const pathname = usePathname();
  const isSupplier = pathname.startsWith("/supplier");

  if (isSupplier) {
    return (
      <button
        onClick={open}
        aria-label="Apri ricerca (Cmd/Ctrl + K)"
        className="hidden sm:flex h-9 w-[240px] md:focus-within:w-[320px] rounded-lg border border-border-subtle bg-surface-muted px-3 items-center gap-2 transition-[width,border-color] duration-[var(--duration-normal,250ms)] ease-[var(--ease-out-expo,cubic-bezier(0.16,1,0.3,1))] text-text-tertiary hover:border-brand-primary-border hover:text-text-secondary"
      >
        <Search className="h-[14px] w-[14px]" />
        <span className="font-sans text-[11px] text-text-tertiary">Cerca...</span>
        <span className="font-mono text-[10px] text-text-tertiary px-1.5 py-0.5 rounded bg-surface-hover border border-border-subtle ml-auto">
          ⌘K
        </span>
      </button>
    );
  }

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
