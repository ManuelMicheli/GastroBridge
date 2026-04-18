// components/ui/celebration-check.tsx
//
// Palette-coherent celebratory checkmark for restaurant-area terminal-ok
// states (delivered, completed). Mounts with a spring overshoot; respects
// prefers-reduced-motion. Tone parameterises fill/icon color.

"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

type Tone = "emerald" | "brand";

type Props = {
  size?: number;
  tone?: Tone;
  className?: string;
};

export function CelebrationCheck({
  size = 14,
  tone = "emerald",
  className,
}: Props) {
  const reduced = useReducedMotion();
  const iconSize = Math.max(8, Math.round(size * 0.62));
  const style = {
    width: size,
    height: size,
    background: `var(--tone-${tone}-bg)`,
    color: `var(--tone-${tone}-fg)`,
  } as React.CSSProperties;

  if (reduced) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          className,
        )}
        style={style}
        aria-label="Completato"
        role="status"
      >
        <Check strokeWidth={3} width={iconSize} height={iconSize} />
      </span>
    );
  }

  return (
    <motion.span
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: [0.2, 1.1, 1], opacity: 1 }}
      transition={{
        duration: 0.55,
        times: [0, 0.6, 1],
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full",
        className,
      )}
      style={style}
      aria-label="Completato"
      role="status"
    >
      <Check strokeWidth={3} width={iconSize} height={iconSize} />
    </motion.span>
  );
}
