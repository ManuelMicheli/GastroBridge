"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

type Tab = { key: string; label: string; content: ReactNode };

export default function ProductDetailTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.key ?? "");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sezioni prodotto"
        className="flex gap-1 border-b border-sage-muted/40 mb-5"
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActive(t.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-forest text-forest bg-forest-light/30"
                  : "border-transparent text-sage hover:text-charcoal",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          hidden={t.key !== active}
          className={t.key === active ? "block" : "hidden"}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
