// app/(app)/fornitori/_components/search-bar-mini.tsx
"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { KeyboardHint } from "@/components/shared/awwwards";

type Props = {
  value: string;
  onChange: (v: string) => void;
  count: number;
  total: number;
  listboxId?: string;
};

export const SearchBarMini = forwardRef<HTMLInputElement, Props>(
  function SearchBarMini({ value, onChange, count, total, listboxId }, ref) {
    return (
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface-base/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              ref={ref}
              type="search"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Cerca fornitore per nome…"
              className="w-full rounded-lg border border-border-subtle bg-surface-card py-2.5 pl-9 pr-20 text-[14px] text-text-primary placeholder:text-text-tertiary focus-ring"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={true}
              aria-autocomplete="list"
              aria-controls={listboxId}
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {value && (
                <button
                  onClick={() => onChange("")}
                  className="text-text-tertiary hover:text-text-primary"
                  aria-label="Pulisci ricerca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {!value && <KeyboardHint keys={["⌘", "K"]} />}
            </div>
          </div>
          <div
            className="shrink-0 font-mono text-[11px] tabular-nums text-text-tertiary"
            aria-live="polite"
          >
            <span>{count}</span>
            <span className="mx-1">/</span>
            <span>{total}</span>
          </div>
        </div>
      </div>
    );
  },
);
