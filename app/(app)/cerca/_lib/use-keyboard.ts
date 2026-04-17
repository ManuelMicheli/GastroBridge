// app/(app)/cerca/_lib/use-keyboard.ts
"use client";

import { useEffect } from "react";

export type KeyHandlers = {
  onFocusSearch?: () => void;
  onArrow?: (dir: 1 | -1) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onAdd?: () => void;
  onToggleFacets?: () => void;
  onShowHelp?: () => void;
};

export function useSearchKeyboard(h: KeyHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // ⌘K / Ctrl+K → focus search (always)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        h.onFocusSearch?.();
        return;
      }

      // `/` → focus search (only when not typing)
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        h.onFocusSearch?.();
        return;
      }

      // Arrow keys — navigate results when not typing inside text input (except search)
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const isSearch = target instanceof HTMLInputElement && target.type === "search";
        if (!isTyping || isSearch) {
          e.preventDefault();
          h.onArrow?.(e.key === "ArrowDown" ? 1 : -1);
        }
        return;
      }

      if (e.key === "Enter") {
        const isSearch = target instanceof HTMLInputElement && target.type === "search";
        if (isSearch || !isTyping) {
          h.onEnter?.();
        }
        return;
      }

      if (e.key === "Escape") {
        h.onEscape?.();
        return;
      }

      if (!isTyping) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          h.onAdd?.();
          return;
        }
        if (e.key.toLowerCase() === "f") {
          h.onToggleFacets?.();
          return;
        }
        if (e.key === "?") {
          h.onShowHelp?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, h.onFocusSearch, h.onArrow, h.onEnter, h.onEscape, h.onAdd, h.onToggleFacets, h.onShowHelp]);
}
