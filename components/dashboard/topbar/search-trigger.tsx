"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCommandPalette } from "../command-palette/command-palette-provider";

/** Fernly pill search field — opens the command palette (⌘/Ctrl + K). */
export function SearchTrigger() {
  const { open } = useCommandPalette();
  const pathname = usePathname();
  const isSupplier = pathname.startsWith("/supplier");

  return (
    <button
      onClick={open}
      aria-label="Apri ricerca (Cmd/Ctrl + K)"
      className="group flex h-11 w-[200px] items-center gap-2.5 rounded-full border border-[var(--f-line)] bg-[var(--f-card)] pl-4 pr-2 text-left transition-[border-color,box-shadow,width] duration-200 hover:border-[var(--f-line-strong)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--acc-600)_22%,transparent)] md:w-[300px] xl:w-[340px]"
    >
      <Search className="h-[18px] w-[18px] shrink-0 text-[var(--f-ink)]" strokeWidth={1.9} />
      <span className="flex-1 truncate text-[14px] text-[var(--f-faint)]">
        {isSupplier ? "Cerca ordini, clienti, prodotti" : "Cerca prodotti, fornitori, ordini"}
      </span>
      <kbd className="hidden h-7 items-center rounded-full bg-[var(--f-fill)] px-2.5 text-[11.5px] font-semibold text-[var(--f-ink-2)] sm:inline-flex">
        ⌘ K
      </kbd>
    </button>
  );
}
