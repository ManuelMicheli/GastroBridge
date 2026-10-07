"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable=true]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0,
  );
}

/**
 * Modal-dialog keyboard behaviour shared by Modal, Drawer, BottomSheet, the
 * mobile nav drawer and the command palette:
 *  - Tab / Shift+Tab cycle inside `ref` (focus trap)
 *  - optional Escape → onEscape
 *  - optional initial focus (first [data-autofocus] / focusable, else the
 *    container) when `autoFocus` is true
 *  - focus returns to the element that opened the dialog on close
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  { onEscape, autoFocus = true }: { onEscape?: () => void; autoFocus?: boolean } = {},
) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;

    const focusId = autoFocus
      ? window.setTimeout(() => {
          const root = ref.current;
          if (!root || root.contains(document.activeElement)) return;
          const first =
            root.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(root)[0] ?? root;
          first.focus({ preventScroll: true });
        }, 30)
      : undefined;

    function onKeyDown(e: KeyboardEvent) {
      const root = ref.current;
      if (!root) return;
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      if (focusId) window.clearTimeout(focusId);
      document.removeEventListener("keydown", onKeyDown);
      if (previous && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [active, ref, onEscape, autoFocus]);
}
