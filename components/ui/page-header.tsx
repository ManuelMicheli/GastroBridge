import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatters";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  divider?: boolean;
  className?: string;
}

/**
 * Fernly page header: big near-black title (revealed left→right on mount),
 * muted subtitle, actions (pill buttons) on the right.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
  divider = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        divider && "pb-6 border-b border-[color:var(--f-line)]",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="f-title f-type">{title}</h1>
          {meta && <div className="flex items-center gap-2">{meta}</div>}
        </div>
        {subtitle && (
          <p className="f-subtitle f-fade mt-1 max-w-[62ch]" style={{ ["--d" as string]: "120ms" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="f-fade flex flex-wrap items-center gap-2 shrink-0" style={{ ["--d" as string]: "80ms" }}>
          {actions}
        </div>
      )}
    </header>
  );
}
