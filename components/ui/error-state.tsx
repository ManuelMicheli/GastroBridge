"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/formatters";

type ErrorStateVariant = "inline" | "page";

interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: ErrorStateVariant;
  className?: string;
}

const variantStyles: Record<ErrorStateVariant, string> = {
  inline: "py-8",
  page: "py-20",
};

export function ErrorState({
  title,
  description,
  action,
  variant = "inline",
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variantStyles[variant],
        className
      )}
      role="alert"
    >
      <div className="mb-4 text-[color:var(--color-error)]">
        <AlertCircle width={24} height={24} strokeWidth={1.5} />
      </div>
      <h3
        className="text-[color:var(--color-text-primary)]"
        style={{
          fontSize: "var(--text-title-md)",
          lineHeight: "var(--text-title-md--line-height)",
          fontWeight: "var(--text-title-md--font-weight)",
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

export type { ErrorStateVariant, ErrorStateProps };
