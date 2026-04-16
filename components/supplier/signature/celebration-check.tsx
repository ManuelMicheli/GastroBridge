"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

type Props = {
  size?: number;
  className?: string;
};

export function CelebrationCheck({ size = 32, className }: Props) {
  const reduced = useReducedMotion();
  const iconSize = Math.round(size * 0.55);

  if (reduced) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-brand-highlight text-brand-highlight-on",
          className,
        )}
        style={{ width: size, height: size }}
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
        duration: 0.6,
        times: [0, 0.6, 1],
        ease: [0.34, 1.56, 0.64, 1],
      }}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-brand-highlight text-brand-highlight-on",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Completato"
      role="status"
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        initial={{ boxShadow: "0 0 0 0 rgba(232, 181, 71, 0.55)" }}
        animate={{ boxShadow: "0 0 0 12px rgba(232, 181, 71, 0)" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <Check strokeWidth={3} width={iconSize} height={iconSize} />
    </motion.span>
  );
}
