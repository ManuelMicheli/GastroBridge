"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

type SidebarContextValue = {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

const STORAGE_KEY = "gb-sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsCollapsed(true);
  }, []);

  const setCollapsed = useCallback((v: boolean) => {
    setIsCollapsed(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

  // Keyboard shortcut: Cmd+B / Ctrl+B
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
