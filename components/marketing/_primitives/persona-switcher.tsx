"use client";

import { useEffect, useRef, useState } from "react";
import { usePersona, type Persona } from "@/lib/marketing-persona-context";

const OPTIONS: readonly { value: Persona; label: string; short: string }[] = [
  { value: "restaurant", label: "Ristoratore", short: "Rist." },
  { value: "supplier", label: "Fornitore", short: "Forn." },
] as const;

type Props = {
  variant?: "compact" | "full";
};

export function PersonaSwitcher({ variant = "compact" }: Props) {
  const { persona, setPersona, hydrated } = usePersona();
  const rootRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLButtonElement>(`[data-active="true"]`);
    if (!active) return;
    const rootRect = root.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setIndicator({
      left: activeRect.left - rootRect.left,
      width: activeRect.width,
    });
  }, [persona, hydrated]);

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label="Cambia prospettiva"
      className="relative inline-flex items-center rounded-full"
      style={{
        background: "var(--color-marketing-bg-soft)",
        border: "1px solid var(--color-marketing-rule-strong)",
        padding: 3,
      }}
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute top-[3px] bottom-[3px] rounded-full will-change-transform"
          style={{
            left: indicator.left,
            width: indicator.width,
            background: "var(--color-marketing-primary)",
            transition: "transform 380ms cubic-bezier(0.16, 1, 0.3, 1), width 380ms cubic-bezier(0.16, 1, 0.3, 1), left 380ms cubic-bezier(0.16, 1, 0.3, 1), background-color 240ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      )}

      {OPTIONS.map((opt) => {
        const isActive = persona === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            data-active={isActive}
            onClick={() => setPersona(opt.value)}
            className="relative z-[1] inline-flex items-center gap-2 px-4 py-1.5 font-mono uppercase tracking-[0.14em] transition-colors"
            style={{
              fontSize: "11px",
              color: isActive ? "var(--color-marketing-on-primary)" : "var(--color-marketing-ink-muted)",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--color-marketing-ink)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--color-marketing-ink-muted)";
            }}
          >
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: isActive
                  ? "var(--color-marketing-on-primary)"
                  : "var(--color-marketing-ink-subtle)",
                opacity: isActive ? 0.7 : 0.5,
              }}
            />
            <span className="hidden sm:inline">{variant === "compact" ? opt.short : opt.label}</span>
            <span className="sm:hidden">{opt.short}</span>
          </button>
        );
      })}
    </div>
  );
}
