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
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        divider && "pb-6 border-b border-[color:var(--color-border-subtle)]",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1
            className="font-display"
            style={{
              fontSize: "var(--text-display-lg)",
              lineHeight: "var(--text-display-lg--line-height)",
              letterSpacing: "var(--text-display-lg--letter-spacing)",
              fontWeight: "var(--text-display-lg--font-weight)",
              color: "var(--color-text-primary)",
            }}
          >
            {title}
          </h1>
          {meta && <div className="flex items-center gap-2">{meta}</div>}
        </div>
        {subtitle && (
          <p
            className="mt-1.5 text-[color:var(--color-text-secondary)]"
            style={{
              fontSize: "var(--text-body-sm)",
              lineHeight: "var(--text-body-sm--line-height)",
              maxWidth: "60ch",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}
