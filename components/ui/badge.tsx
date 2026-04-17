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

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-charcoal/10 text-charcoal",
  success: "bg-forest-light text-forest-dark",
  warning: "bg-terracotta-light text-terracotta",
  info: "bg-sage-muted text-charcoal",
  outline: "border border-sage-muted text-sage bg-transparent",
  brand: "bg-brand-primary-subtle text-brand-primary",
  highlight: "bg-brand-highlight text-brand-highlight-on",
  error: "bg-error-subtle text-error",
  neutral: "bg-surface-hover text-text-secondary",
};

const sizeMap: Record<BadgeSize, string> = {
  xs: "text-[9px] px-1.5 py-0.5 gap-1",
  sm: "text-[11px] px-2 py-0.5 gap-1.5",
  md: "text-[13px] px-2.5 py-1 gap-2",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-charcoal",
  success: "bg-forest-dark",
  warning: "bg-terracotta",
  info: "bg-charcoal",
  outline: "bg-sage",
  brand: "bg-brand-primary",
  highlight: "bg-brand-highlight-on",
  error: "bg-error",
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
  const legacySize = "px-2.5 py-0.5 text-xs";
  const typography = mono
    ? "font-mono tracking-normal font-semibold"
    : "font-body font-semibold uppercase tracking-wider";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full",
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
