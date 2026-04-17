"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface StickyActionBarProps {
  children: ReactNode;
  className?: string;
  /** When true, only renders on viewports < md (mobile). Default true. */
  mobileOnly?: boolean;
  /** Optional left-side content (e.g., total summary) */
  leading?: ReactNode;
}

/**
 * StickyActionBar — fixed bottom CTA container with safe-area inset.
 * Used for /carrello checkout, /ordini detail actions, /cerca add-to-cart.
 * Hides on md+ by default unless mobileOnly={false}.
 */
export function StickyActionBar({
  children,
  className,
  mobileOnly = true,
  leading,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "border-t border-sage-muted/60 bg-white/95 backdrop-blur-md",
        "pb-[var(--safe-bottom)]",
        mobileOnly && "md:hidden",
        className
      )}
      role="toolbar"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {leading && <div className="flex-1 min-w-0">{leading}</div>}
        <div
          className={cn(
            "flex items-center gap-2",
            !leading && "flex-1 justify-end"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
