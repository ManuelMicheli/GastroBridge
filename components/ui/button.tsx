"use client";

import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/formatters";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost"
  | "link"
  | "celebration";
type ButtonSize = "sm" | "md" | "lg" | "icon";
type ButtonDensity = "comfortable" | "compact";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  density?: ButtonDensity;
  isLoading?: boolean;
}

// Fernly pill buttons. Variants read the workspace accent through CSS
// variables (`--acc-*`, see the Fernly layer in globals.css) so the same
// component re-tints with the area/preset. Hardcoded hex is never used here.
const variantStyles: Record<ButtonVariant, string> = {
  primary: "f-btn-primary",
  secondary: "f-btn-outline",
  destructive: "f-btn-danger",
  ghost: "f-btn-ghost",
  link: "!h-auto !px-0 !border-0 bg-transparent text-[var(--acc-700)] underline-offset-4 hover:underline",
  celebration: "f-btn-primary",
};

// Comfortable = legacy sizes (40/46 px pills). Compact = denser pills
// (28/32/40 px) — opt-in via density="compact".
const sizeStyles: Record<ButtonSize, string> = {
  sm: "f-btn-sm",
  md: "",
  lg: "f-btn-lg",
  icon: "!w-10 !px-0",
};

const compactSizeStyles: Record<ButtonSize, string> = {
  sm: "f-btn-xs",
  md: "f-btn-sm",
  lg: "",
  icon: "!h-8 !w-8 !px-0",
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
    return (
      <button
        ref={ref}
        className={cn(
          "f-btn",
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

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  density?: ButtonDensity;
};

/**
 * A link that looks like a Button. Use it instead of nesting <Button> inside
 * <Link> (a <button> inside an <a> is invalid HTML and is announced twice by
 * screen readers).
 */
function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  density = "comfortable",
  ...props
}: ButtonLinkProps) {
  const sizes = density === "compact" ? compactSizeStyles : sizeStyles;
  return (
    <Link
      className={cn("f-btn", variantStyles[variant], sizes[size], className)}
      {...props}
    />
  );
}

export { Button, ButtonLink, type ButtonProps, type ButtonVariant, type ButtonSize, type ButtonDensity };
