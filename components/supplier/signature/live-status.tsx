"use client";

import { PulseDot } from "./pulse-dot";
import { cn } from "@/lib/utils/formatters";

type Props = {
  count: number;
  label: string;
  variant?: "live" | "warning" | "brand";
  className?: string;
};

export function LiveStatus({ count, label, variant = "live", className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-muted px-3 py-1",
        className,
      )}
    >
      <PulseDot variant={variant} />
      <span className="font-mono text-[11px] text-text-secondary">
        <b className="text-text-primary font-semibold">{count}</b> {label}
      </span>
    </div>
  );
}
