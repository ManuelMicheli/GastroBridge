"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  function onClick() {
    const next = isDark ? "light" : "dark";
    const vt = (document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    }).startViewTransition;
    if (typeof vt === "function") {
      vt.call(document, () => setTheme(next));
    } else {
      setTheme(next);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={mounted ? (isDark ? "Passa a tema chiaro" : "Passa a tema scuro") : "Cambia tema"}
      className="inline-flex items-center justify-center rounded-full transition-colors"
      style={{
        width: 36,
        height: 36,
        background: "transparent",
        border: "1px solid var(--color-marketing-rule-strong)",
        color: "var(--color-marketing-ink-muted)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--color-marketing-ink)";
        e.currentTarget.style.borderColor = "var(--color-marketing-ink-muted)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--color-marketing-ink-muted)";
        e.currentTarget.style.borderColor = "var(--color-marketing-rule-strong)";
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{
          transition: "transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease",
          transform: isDark ? "rotate(0deg)" : "rotate(-25deg)",
        }}
      >
        {isDark ? (
          <circle cx="12" cy="12" r="4.2" />
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        )}
      </svg>
    </button>
  );
}
