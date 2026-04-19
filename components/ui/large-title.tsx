import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface LargeTitleProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * LargeTitle — editorial hero header for mobile routes.
 * Eyebrow caption (carmine tracked) + serif Georgia display title + subtitle.
 * Mirrors iOS UINavigationBar largeTitle but with editorial serif.
 * Viewport agnostic — container-query responsive via fluid tokens.
 */
export function LargeTitle({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: LargeTitleProps) {
  return (
    <div className={cn("px-4 pt-3 pb-1 md:px-6 md:pt-5", className)}>
      {eyebrow && (
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--caption-color)]">
          {eyebrow}
        </div>
      )}
      <div className="mt-1 flex items-end justify-between gap-3">
        <h1
          className="font-serif text-[length:var(--text-display-lg)] font-medium leading-[var(--text-display-lg--line-height)] tracking-[-0.022em] text-[color:var(--color-text-primary)]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          tabIndex={-1}
        >
          {title}
        </h1>
        {actions && <div className="flex-shrink-0 pb-1">{actions}</div>}
      </div>
      {subtitle && (
        <p className="mt-0.5 text-[13px] leading-snug text-[color:var(--color-text-secondary,#6B6B6B)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
