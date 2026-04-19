"use client";

import { cn } from "@/lib/utils/formatters";

type PulseVariant = "live" | "warning" | "brand";

const variantColors: Record<PulseVariant, string> = {
  live: "bg-success",
  warning: "bg-warning",
  brand: "bg-brand-primary",
};

const ringColors: Record<PulseVariant, string> = {
  live: "border-success",
  warning: "border-warning",
  brand: "border-brand-primary",
};

type Props = {
  variant?: PulseVariant;
  size?: number;
  label?: string;
  className?: string;
};

export function PulseDot({
  variant = "live",
  size = 8,
  label,
  className,
}: Props) {
  return (
    <span
      role="status"
      aria-label={label ?? `${variant} indicator`}
      className={cn("inline-flex items-center gap-3", className)}
    >
      <span
        className={cn(
          "relative inline-block rounded-full",
          variantColors[variant],
        )}
        style={{ width: size, height: size }}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-[-3px] rounded-full border-2 opacity-60 motion-reduce:hidden",
            ringColors[variant],
          )}
          style={{
            animation: "pulse-ring var(--duration-pulse, 1800ms) ease-out infinite",
          }}
        />
      </span>
      {label ? (
        <span className="font-mono text-[11px] text-text-secondary">
          {label}
        </span>
      ) : null}
    </span>
  );
}
