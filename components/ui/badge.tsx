import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatters";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "info"
  | "outline"
  | "brand"
  | "highlight"
  | "error"
  | "neutral";

type BadgeSize = "xs" | "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  mono?: boolean;
}

// Fernly status pills: hairline outline + soft tint. Semantic variants use
// fixed semantic colours (never the workspace accent); `brand` follows it.
const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--f-fill)] text-[var(--f-ink-2)] border border-[var(--f-line-strong)]",
  success:
    "bg-[var(--f-success-bg)] text-[var(--f-success)] border border-[color:color-mix(in_oklab,var(--f-success)_40%,transparent)]",
  warning:
    "bg-[var(--f-warning-bg)] text-[var(--f-warning)] border border-[color:color-mix(in_oklab,var(--f-warning)_40%,transparent)]",
  info: "bg-[var(--f-info-bg)] text-[var(--f-info)] border border-[color:color-mix(in_oklab,var(--f-info)_35%,transparent)]",
  outline: "border border-[var(--f-line-strong)] text-[var(--f-muted)] bg-transparent",
  brand: "bg-[var(--acc-50)] text-[var(--acc-700)] border border-[color:color-mix(in_oklab,var(--acc-600)_30%,transparent)]",
  highlight: "bg-[var(--acc-800)] text-white border border-transparent",
  error:
    "bg-[var(--f-danger-bg)] text-[var(--f-danger)] border border-[color:color-mix(in_oklab,var(--f-danger)_35%,transparent)]",
  neutral: "bg-surface-hover text-text-secondary border border-transparent",
};

const sizeMap: Record<BadgeSize, string> = {
  xs: "text-[9px] px-1.5 py-0.5 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[13px] px-2.5 py-1 gap-2",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-[var(--f-ink-2)]",
  success: "bg-[var(--f-success)]",
  warning: "bg-[var(--f-warning)]",
  info: "bg-[var(--f-info)]",
  outline: "bg-[var(--f-muted)]",
  brand: "bg-[var(--acc-600)]",
  highlight: "bg-white",
  error: "bg-[var(--f-danger)]",
  neutral: "bg-text-secondary",
};

function Badge({
  className,
  variant = "default",
  size,
  dot = false,
  mono = false,
  children,
  ...props
}: BadgeProps) {
  const legacySize = "px-2 py-0.5 text-[11.5px]";
  const typography = mono
    ? "tabular-nums tracking-normal font-semibold"
    : "font-medium tracking-normal";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[7px] leading-tight whitespace-nowrap",
        typography,
        size ? sizeMap[size] : legacySize,
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            dotColors[variant]
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, type BadgeProps, type BadgeVariant, type BadgeSize };
