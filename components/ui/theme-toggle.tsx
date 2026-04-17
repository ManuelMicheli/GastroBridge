"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

type ThemeToggleVariant = "icon" | "icon-label";

type Props = {
  /**
   * - "icon" (default): square icon-only button, matches the topbar/notification-bell style
   * - "icon-label": icon + Italian label, used in expanded sidebar / mobile drawer
   */
  variant?: ThemeToggleVariant;
  className?: string;
};

/**
 * Light/Dark theme toggle. SSR-safe (renders a skeleton until mounted),
 * accessible (aria-label in Italian, updates dynamically), and respects
 * `prefers-reduced-motion` (no icon rotation when the user opts out).
 *
 * Persists via next-themes (localStorage key "theme").
 */
export function ThemeToggle({ variant = "icon", className }: Props) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR / pre-mount placeholder — same dimensions, no hydration mismatch.
  if (!mounted) {
    if (variant === "icon-label") {
      return (
        <div
          aria-hidden
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl",
            className
          )}
        >
          <span className="h-5 w-5 rounded bg-surface-hover" />
          <span className="h-3 w-24 rounded bg-surface-hover" />
        </div>
      );
    }
    return (
      <div
        aria-hidden
        className={cn(
          "h-9 w-9 rounded-lg bg-surface-hover",
          className
        )}
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  const ariaLabel = isDark ? "Attiva modalità chiara" : "Attiva modalità scura";
  const labelText = isDark ? "Tema chiaro" : "Tema scuro";

  if (variant === "icon-label") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors",
          className
        )}
      >
        <span className="theme-toggle-icon relative inline-flex h-5 w-5 items-center justify-center">
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </span>
        <span className="flex-1 text-left">{labelText}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "relative p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-hover transition-colors",
        className
      )}
    >
      <span className="theme-toggle-icon relative inline-flex h-5 w-5 items-center justify-center">
        {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </span>
    </button>
  );
}
