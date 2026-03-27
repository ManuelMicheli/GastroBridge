"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { NavItem } from "../sidebar/sidebar-item";
import type { SearchItem } from "./use-fuzzy-search";

type CommandPaletteContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  searchItems: SearchItem[];
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

type Props = {
  children: ReactNode;
  navItems: NavItem[];
  role: "restaurant" | "supplier";
};

export function CommandPaletteProvider({ children, navItems, role }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Build search items from nav items + quick actions
  const searchItems = useMemo<SearchItem[]>(() => {
    const pages: SearchItem[] = navItems.map((item) => ({
      id: `page-${item.href}`,
      label: item.label,
      section: "Pagine",
      href: item.href,
    }));

    const actions: SearchItem[] =
      role === "restaurant"
        ? [
            { id: "action-search", label: "Cerca prodotti", section: "Azioni", href: "/cerca", keywords: ["search", "find", "prodotto"] },
            { id: "action-cart", label: "Vai al carrello", section: "Azioni", href: "/carrello", keywords: ["cart", "basket"] },
            { id: "action-order", label: "Nuovo ordine", section: "Azioni", href: "/cerca", keywords: ["order", "ordine", "nuovo"] },
          ]
        : [
            { id: "action-new-product", label: "Aggiungi prodotto", section: "Azioni", href: "/supplier/catalogo/nuovo", keywords: ["add", "product", "nuovo", "prodotto"] },
            { id: "action-import", label: "Importa CSV", section: "Azioni", href: "/supplier/catalogo/import", keywords: ["import", "csv", "bulk"] },
            { id: "action-zones", label: "Gestisci zone consegna", section: "Azioni", href: "/supplier/impostazioni/zone", keywords: ["delivery", "zone", "consegna"] },
          ];

    return [...pages, ...actions];
  }, [navItems, role]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, close, isOpen]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, open, close, toggle, searchItems }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}
