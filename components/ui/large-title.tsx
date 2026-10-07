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
 * Eyebrow caption + Fernly display title (app grotesk) + muted subtitle.
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
        <div className="f-eyebrow">
          {eyebrow}
        </div>
      )}
      <div className="mt-1 flex items-end justify-between gap-3">
        <h1 className="f-title f-type" tabIndex={-1}>
          {title}
        </h1>
        {actions && <div className="flex-shrink-0 pb-1">{actions}</div>}
      </div>
      {subtitle && (
        <p className="f-subtitle mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}
