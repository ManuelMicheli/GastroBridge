import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils/formatters";

type EmptyStateContext = "page" | "section" | "search" | "filter";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  context?: EmptyStateContext;
  className?: string;
}

const contextStyles: Record<EmptyStateContext, string> = {
  page: "py-20",
  section: "py-12",
  search: "py-16",
  filter: "py-12",
};

export function EmptyState({
  title,
  description,
  action,
  illustration,
  icon: Icon,
  context = "page",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        contextStyles[context],
        className
      )}
    >
      {illustration && (
        <div className="mb-6 text-[color:var(--color-text-tertiary)]">
          {illustration}
        </div>
      )}
      {!illustration && Icon && (
        <div className="mb-4 text-[color:var(--color-text-tertiary)]">
          <Icon width={32} height={32} strokeWidth={1.5} />
        </div>
      )}
      <h3
        className="text-[color:var(--color-text-primary)]"
        style={{
          fontSize: "var(--text-title-md)",
          lineHeight: "var(--text-title-md--line-height)",
          fontWeight: "var(--text-title-md--font-weight)",
          letterSpacing: "var(--text-title-md--letter-spacing)",
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 max-w-sm text-[color:var(--color-text-secondary)]"
          style={{
            fontSize: "var(--text-body-sm)",
            lineHeight: "var(--text-body-sm--line-height)",
          }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export type { EmptyStateContext, EmptyStateProps };
