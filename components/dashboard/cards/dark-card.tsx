import { cn } from "@/lib/utils/formatters";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  noPadding?: boolean;
};

export function DarkCard({ children, className, glow, noPadding }: Props) {
  return (
    <div
      className={cn(
        "bg-surface-card border border-border-subtle rounded-2xl shadow-card-dark transition-all",
        glow && "hover:border-border-accent hover:shadow-[var(--glow-forest)]",
        !noPadding && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DarkCardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

export function DarkCardTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-text-primary">{children}</h3>;
}
