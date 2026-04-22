// app/(app)/cerca/_components/search-bar.tsx
"use client";

import { forwardRef, useEffect, useState, useRef, useCallback } from "react";
import { Search, X, History } from "lucide-react";
import { KeyboardHint } from "./keyboard-hint";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  count: number;
  total: number;
  isSearching: boolean;
  listboxId?: string;
};

const RECENT_KEY = "gb_cerca_recent";
const RECENT_MAX = 6;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(q: string) {
  if (typeof window === "undefined") return;
  const cur = readRecent().filter((s) => s.toLowerCase() !== q.toLowerCase());
  const next = [q, ...cur].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, onClear, count, total, isSearching, listboxId },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const savedRef = useRef<string>("");

  useEffect(() => setRecent(readRecent()), []);

  // Persist query as recent after user stops typing for 1.2s (avoids noisy saves).
  useEffect(() => {
    const v = value.trim();
    if (!v || v === savedRef.current) return;
    const t = setTimeout(() => {
      if (v.length >= 2) {
        writeRecent(v);
        savedRef.current = v;
        setRecent(readRecent());
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [value]);

  const pickRecent = useCallback(
    (q: string) => {
      onChange(q);
      savedRef.current = q;
    },
    [onChange],
  );

  const showSuggestions = focused && !value && recent.length > 0;
  const noResults = !!value && !isSearching && count === 0;

  return (
    <div className="sticky top-0 z-20 border-b border-border-subtle bg-surface-base/90 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex-1">
          <Search
            className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
              focused ? "text-accent-green" : "text-text-tertiary"
            }`}
          />
          <input
            ref={ref}
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            placeholder="Cerca tra i tuoi prodotti…"
            className={`w-full rounded-lg border bg-surface-card py-2.5 pl-9 pr-24 text-[14px] text-text-primary placeholder:text-text-tertiary focus-ring transition-colors ${
              noResults
                ? "border-red-500/40"
                : focused
                  ? "border-accent-green/60"
                  : "border-border-subtle"
            }`}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={focused}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-busy={isSearching}
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {isSearching && (
              <span
                className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-green"
                aria-hidden
              />
            )}
            {value && (
              <button
                onClick={onClear}
                type="button"
                className="rounded p-0.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label="Pulisci ricerca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {!value && <KeyboardHint keys={["⌘", "K"]} />}
          </div>

          {showSuggestions && (
            <div
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border-subtle bg-surface-card shadow-lg"
              role="listbox"
            >
              <div className="flex items-center gap-1.5 border-b border-border-subtle px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
                <History className="h-3 w-3" /> recenti
              </div>
              <ul className="max-h-60 overflow-y-auto py-1">
                {recent.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickRecent(q);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <Search className="h-3 w-3 shrink-0 text-text-tertiary" />
                      <span className="truncate">{q}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          className="shrink-0 font-mono text-[11px] tabular-nums text-text-tertiary"
          aria-live="polite"
        >
          <span
            className={`transition-opacity duration-150 ${
              isSearching ? "opacity-40" : "opacity-100"
            }`}
          >
            {count}
          </span>
          <span className="mx-1">/</span>
          <span>{total}</span>
        </div>
      </div>
    </div>
  );
});
