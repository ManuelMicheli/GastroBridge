"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatters";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg";
type ButtonDensity = "comfortable" | "compact";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  density?: ButtonDensity;
  isLoading?: boolean;
}

// NOTE: variants read from CSS variables so the same component renders the
// correct brand color in each area (restaurant = carmine, supplier = forest).
// Hardcoded hex is NEVER used here — each area's `data-area` scope swaps the
// underlying --color-brand-* tokens.
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-brand-on-primary hover:bg-brand-primary-hover active:bg-brand-primary-active shadow-sm",
  secondary:
    "border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-brand-on-primary",
  destructive:
    "bg-error text-white hover:bg-error/90 active:bg-error/80 shadow-sm",
  ghost: "text-charcoal hover:bg-sage-muted/50",
  link: "text-brand-primary underline-offset-4 hover:underline p-0 h-auto",
};

// Comfortable = legacy sizes (used by supplier + existing restaurant code).
// Compact    = Linear-grade density (28/32/40 px height) — opt-in via density="compact".
const sizeStyles: Record<ButtonSize, string> = {
  sm: "py-2 px-4 text-sm",
  md: "py-3.5 px-6 text-base",
  lg: "py-4 px-8 text-lg",
};

const compactSizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-sm",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      density = "comfortable",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const sizes = density === "compact" ? compactSizeStyles : sizeStyles;
    const radius = density === "compact" ? "rounded-md" : "rounded-xl";
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-body font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          radius,
          variantStyles[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize, type ButtonDensity };
