"use client";

import { useEffect, useRef, useState } from "react";
import { useIntersectionOnce } from "@/lib/hooks/useIntersectionOnce";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { cn } from "@/lib/utils/formatters";

export type CountUpFormat = "currency" | "number" | "percent" | "compact";

type Props = {
  value: number;
  format?: CountUpFormat;
  decimals?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

function formatValue(value: number, format: CountUpFormat, decimals: number): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case "percent":
      return `${value.toFixed(decimals)}%`;
    case "compact":
      return new Intl.NumberFormat("it-IT", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
    case "number":
    default:
      return new Intl.NumberFormat("it-IT", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
  }
}

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function CountUp({
  value,
  format = "number",
  decimals = 0,
  duration = 1400,
  delay = 0,
  prefix,
  suffix,
  className,
}: Props) {
  const { ref, hasIntersected } = useIntersectionOnce<HTMLSpanElement>();
  const prefersReduced = useReducedMotion();
  const [displayed, setDisplayed] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    if (!hasIntersected) return;
    if (prefersReduced) {
      setDisplayed(value);
      return;
    }

    fromRef.current = displayed;
    startRef.current = null;
    let rafId = 0;

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t + delay;
      const elapsed = t - startRef.current;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(1, elapsed / duration);
      const next = fromRef.current + (value - fromRef.current) * ease(progress);
      setDisplayed(next);
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, hasIntersected, prefersReduced, duration, delay]);

  return (
    <span
      ref={ref}
      className={cn("tabular-nums tracking-tight [font-feature-settings:'tnum']", className)}
    >
      {prefix}
      {formatValue(displayed, format, decimals)}
      {suffix}
    </span>
  );
}
