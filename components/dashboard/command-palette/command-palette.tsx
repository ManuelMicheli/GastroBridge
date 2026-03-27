"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Search } from "lucide-react";
import { useCommandPalette } from "./command-palette-provider";
import { useFuzzySearch } from "./use-fuzzy-search";
import { CommandItem } from "./command-item";

export function CommandPalette() {
  const { isOpen, close, searchItems } = useCommandPalette();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
            className="fixed inset-0 bg-surface-overlay backdrop-blur-sm z-50"
            onClick={close}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-[90vw] max-w-lg bg-surface-elevated border border-border-default rounded-2xl shadow-elevated-dark z-50 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
              <Search className="h-5 w-5 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Cerca pagine, azioni..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-surface-base text-[10px] font-mono text-text-tertiary border border-border-subtle">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-2">
              {Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  <p className="px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold text-text-tertiary">
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

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-tertiary">
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
