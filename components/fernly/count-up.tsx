"use client";

import { useEffect, useRef, useState } from "react";

function prefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// power3.out — matches the reference count-up (fast start, long settle).
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Tweened number. First mount counts up from 0 (spec §5: ≈1.1 s, ease-out,
 * small delay so it starts once its card has risen in); later changes tween
 * from the previously displayed value. Reduced motion → jumps to the value.
 */
export function useCountUp(
  value: number,
  { duration = 1100, delay = 160 }: { duration?: number; delay?: number } = {},
): number {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (prefersReduced()) {
      displayRef.current = value;
      setDisplay(value);
      first.current = false;
      return;
    }
    const from = displayRef.current;
    const wait = first.current ? delay : 0;
    const dur = first.current ? duration : Math.min(900, duration);
    first.current = false;
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t + wait;
      const p = Math.min(1, Math.max(0, (t - start) / dur));
      const v = from + (value - from) * easeOut(p);
      displayRef.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  return display;
}

export type CountFormat = "number" | "currency" | "currency0" | "percent" | "decimal1";

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("it-IT", opts);
    fmtCache.set(key, f);
  }
  return f;
}

export function formatCount(v: number, format: CountFormat): string {
  switch (format) {
    case "currency":
      return nf("c2", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    case "currency0":
      return nf("c0", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
    case "percent":
      return `${nf("p0", { maximumFractionDigits: 0 }).format(v)}%`;
    case "decimal1":
      return nf("d1", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
    default:
      return nf("n0", { maximumFractionDigits: 0 }).format(Math.round(v));
  }
}

export function CountUp({
  value,
  format = "number",
  duration,
  delay,
  className,
}: {
  value: number;
  format?: CountFormat;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const v = useCountUp(value, { duration, delay });
  return (
    <span className={className ?? "f-num"} aria-label={formatCount(value, format)}>
      <span aria-hidden>{formatCount(v, format)}</span>
    </span>
  );
}
