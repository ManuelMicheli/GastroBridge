"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Search, X } from "lucide-react";
import { useCommandPalette } from "./command-palette-provider";
import { useFuzzySearch } from "./use-fuzzy-search";
import { CommandItem } from "./command-item";
import { cn } from "@/lib/utils/formatters";

export function CommandPalette() {
  const { isOpen, close, searchItems } = useCommandPalette();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Esc is handled by the provider; trap Tab and restore focus on close.
  useFocusTrap(panelRef, isOpen, { autoFocus: false });
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useFuzzySearch(searchItems, query);
  const displayItems = query ? results : searchItems.slice(0, 6);

  // Group items by section
  const grouped: Record<string, typeof displayItems> = {};
  for (const item of displayItems) {
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section]!.push(item);
  }

  const flatItems = displayItems;

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (item: (typeof displayItems)[0]) => {
      if (item.href) {
        router.push(item.href);
      }
      close();
    },
    [router, close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === "Enter" && flatItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(flatItems[selectedIndex]);
      }
    },
    [flatItems, selectedIndex, handleSelect]
  );

  let itemIdx = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-[rgba(20,24,22,0.28)] backdrop-blur-[4px] z-50"
            onClick={close}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Cerca pagine e azioni"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed z-50 bg-[var(--f-card)] border border-[var(--f-line)] shadow-[0_2px_6px_rgba(16,24,20,0.06),0_28px_64px_rgba(16,24,20,0.20)] overflow-hidden",
              // Mobile: full-screen flex column
              "inset-0 flex flex-col md:inset-auto md:block",
              // Desktop: centered panel
              "md:left-1/2 md:top-[18%] md:-translate-x-1/2 md:w-[90vw] md:max-w-xl md:rounded-[22px]"
            )}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-4 md:py-3 border-b border-border-subtle">
              <Search className="h-5 w-5 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Cerca pagine, azioni..."
                className="flex-1 bg-transparent text-base md:text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              />
              <kbd className="hidden md:inline-flex h-6 items-center px-2 rounded-full bg-[var(--f-fill)] text-[10.5px] font-semibold text-[var(--f-ink-2)]">
                ESC
              </kbd>
              <button
                onClick={close}
                className="md:hidden p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover focus-ring"
                aria-label="Chiudi ricerca"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 md:flex-none md:max-h-72 overflow-y-auto py-2">
              {Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  <p className="f-eyebrow px-4 py-1.5">
                    {section}
                  </p>
                  {items.map((item) => {
                    const currentIdx = itemIdx++;
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={currentIdx === selectedIndex}
                        onSelect={() => handleSelect(item)}
                      />
                    );
                  })}
                </div>
              ))}

              {query && displayItems.length === 0 && (
                <p className="text-center text-sm text-text-tertiary py-8">
                  Nessun risultato per &ldquo;{query}&rdquo;
                </p>
              )}
            </div>

            {/* Footer hint — desktop only (no physical kbd on mobile) */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-tertiary">
              <span>↑↓ naviga</span>
              <span>↵ seleziona</span>
              <span>esc chiudi</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
