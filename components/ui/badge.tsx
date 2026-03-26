import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatters";

type BadgeVariant = "default" | "success" | "warning" | "info" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-charcoal/10 text-charcoal",
  success: "bg-forest-light text-forest-dark",
  warning: "bg-terracotta-light text-terracotta",
  info: "bg-sage-muted text-charcoal",
  outline: "border border-sage-muted text-sage bg-transparent",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold uppercase tracking-wider",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeProps, type BadgeVariant };
